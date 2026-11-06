use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, hash::{Hash, Hasher}, io::Write, path::{Path, PathBuf}, sync::Mutex, time::{SystemTime, UNIX_EPOCH}};
use tauri::{Manager, State};

const DOCUMENT_LIMIT: u64 = 8 * 1024 * 1024;
const IMAGE_LIMIT: u64 = 12 * 1024 * 1024;
const LIBRARY_LIMIT: usize = 3000;

#[derive(Clone, Serialize, Deserialize, Default)]
struct Registry { roots: Vec<PathBuf>, files: Vec<PathBuf>, #[serde(default)] portable_origin: Option<PathBuf> }
struct LibraryState { registry: Mutex<Registry>, pending_drops: Mutex<HashSet<PathBuf>>, storage: PathBuf, portable_root: Option<PathBuf> }
#[derive(Serialize)]
struct MarkdownDocument { id: String, path: String, name: String, content: String, modified: u128 }

// A marker opts in: the installed executable continues to use the normal Windows profile.
fn portable_data_dir(executable: &Path) -> Option<PathBuf> {
    let parent = executable.parent()?;
    parent.join("noetia.portable").is_file().then(|| parent.join("NoetiaData"))
}
fn relocate_portable_registry(registry: &mut Registry, current: &Path) -> bool {
    if registry.portable_origin.as_deref() == Some(current) { return false; }
    if let Some(previous) = &registry.portable_origin {
        for path in registry.roots.iter_mut().chain(registry.files.iter_mut()) {
            if let Ok(relative) = path.strip_prefix(previous) { *path = current.join(relative); }
        }
    }
    registry.portable_origin = Some(current.to_path_buf());
    true
}
fn library_document(path: &Path, state: &LibraryState) -> Result<MarkdownDocument, String> {
    let mut doc = document(path)?;
    if let Some(root) = &state.portable_root {
        if let Ok(relative) = path.strip_prefix(root) { doc.id = format!("portable:{}", relative.to_string_lossy().replace('\\', "/")); }
    }
    Ok(doc)
}

fn markdown(path: &Path) -> bool {
    path.extension().and_then(|x| x.to_str()).map(|x| matches!(x.to_lowercase().as_str(), "md" | "markdown")).unwrap_or(false)
}
fn allowed_path(path: &str, state: &LibraryState) -> Result<PathBuf, String> {
    let target = fs::canonicalize(path).map_err(|_| "Arquivo indisponível. Ele pode ter sido movido ou excluído.".to_string())?;
    let registry = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?;
    if !registry.roots.iter().any(|root| target.starts_with(root)) {
        return Err("Adicione a pasta desse arquivo à biblioteca para acessá-lo.".into());
    }
    Ok(target)
}
fn document(path: &Path) -> Result<MarkdownDocument, String> {
    if !markdown(path) { return Err("Selecione um arquivo .md ou .markdown.".into()); }
    let info = fs::metadata(path).map_err(|e| e.to_string())?;
    if !info.is_file() || info.len() > DOCUMENT_LIMIT { return Err("Limite de 8 MB por documento.".into()); }
    let content = fs::read_to_string(path).map_err(|_| "Não foi possível ler o documento. Use texto UTF-8.".to_string())?;
    let value = path.to_string_lossy().into_owned();
    Ok(MarkdownDocument { id: value.clone(), path: value, name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), content, modified: info.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|t| t.as_millis()).unwrap_or(0) })
}
fn save_registry(registry: &Registry, storage: &Path) -> Result<(), String> {
    let temp = storage.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec_pretty(registry).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(temp, storage).map_err(|e| e.to_string())
}
fn write_document(safe: &Path, content: &str, expected: &str, backups: &Path) -> Result<MarkdownDocument, String> {
    if content.len() as u64 > DOCUMENT_LIMIT { return Err("Limite de 8 MB por documento.".into()); }
    let original = document(safe)?;
    if original.content != expected { return Err("O arquivo mudou fora do editor. Compare as versões antes de salvar.".into()); }
    if fs::metadata(safe).map_err(|e| e.to_string())?.permissions().readonly() { return Err("Este arquivo está marcado como somente leitura.".into()); }
    fs::create_dir_all(backups).map_err(|e| e.to_string())?;
    let mut hash = std::collections::hash_map::DefaultHasher::new(); safe.hash(&mut hash);
    // Keep the latest pre-save version in app data, outside the user's Markdown folders.
    let backup = backups.join(format!("{:016x}.md", hash.finish()));
    fs::write(&backup, original.content.as_bytes()).map_err(|e| format!("Não foi possível guardar a cópia de recuperação: {}", e))?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let temp = safe.with_file_name(format!(".{}.noetia-{}-{}.tmp", safe.file_name().unwrap_or_default().to_string_lossy(), std::process::id(), stamp));
    let result: Result<MarkdownDocument, String> = (|| {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        file.set_permissions(fs::metadata(safe).map_err(|e| e.to_string())?.permissions()).map_err(|e| e.to_string())?;
        drop(file);
        if document(safe)?.content != expected { return Err("O arquivo mudou durante o salvamento. Seu rascunho foi preservado.".into()); }
        fs::rename(&temp, safe).map_err(|e| format!("Não foi possível substituir o arquivo: {}", e))?;
        document(safe)
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}
fn scan(root: &Path, output: &mut Vec<PathBuf>, depth: usize) -> Result<(), String> {
    if depth > 16 { return Ok(()); }
    let entries = match fs::read_dir(root) { Ok(entries) => entries, Err(_) => return Ok(()) };
    for entry in entries.flatten() {
        if output.len() >= LIBRARY_LIMIT { return Err("A pasta excede 3.000 documentos. Escolha uma subpasta menor.".into()); }
        let kind = match entry.file_type() { Ok(kind) => kind, Err(_) => continue };
        // Skip symlinks and junction-like redirections; canonical scope validation is also enforced on reads.
        if kind.is_symlink() { continue; }
        let path = entry.path();
        if kind.is_dir() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if !matches!(name.as_str(), ".git" | "node_modules" | "target" | "dist" | "build" | ".next") { scan(&path, output, depth + 1)?; }
        } else if markdown(&path) { output.push(path); }
    }
    Ok(())
}
fn add_selected(selected: Vec<PathBuf>, state: &LibraryState) -> Result<Vec<MarkdownDocument>, String> {
    let mut new_roots = Vec::new();
    let mut paths = Vec::new();
    for path in selected {
        let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
        if path.is_dir() { scan(&path, &mut paths, 0)?; new_roots.push(path); }
        else if markdown(&path) {
            if let Some(parent) = path.parent() { new_roots.push(parent.to_path_buf()); }
            paths.push(path);
        }
    }
    paths.sort(); paths.dedup();
    if paths.len() > LIBRARY_LIMIT { return Err("Escolha até 3.000 documentos.".into()); }
    let mut results = Vec::new();
    // Validate the canonical destination even for files found through directory traversal.
    for path in paths {
        let canonical = match fs::canonicalize(path) { Ok(path) => path, Err(_) => continue };
        if !new_roots.iter().any(|root| canonical.starts_with(root)) { continue; }
        results.push(library_document(&canonical, state)?);
    }
    if results.is_empty() { return Err("Nenhum documento Markdown encontrado na seleção.".into()); }
    let mut registry = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?;
    let mut next = registry.clone();
    for root in new_roots { if !next.roots.contains(&root) { next.roots.push(root); } }
    for doc in &results { let path = PathBuf::from(&doc.path); if !next.files.contains(&path) { next.files.push(path); } }
    save_registry(&next, &state.storage)?;
    *registry = next;
    Ok(results)
}

#[tauri::command]
async fn pick_documents(app: tauri::AppHandle) -> Result<Vec<MarkdownDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let files = rfd::FileDialog::new().set_title("Abrir no Noetia").add_filter("Markdown", &["md", "markdown"]).pick_files();
        match files { Some(files) => add_selected(files, &app.state::<LibraryState>()), None => Ok(Vec::new()) }
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Vec<MarkdownDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = rfd::FileDialog::new().set_title("Adicionar pasta à biblioteca").pick_folder();
        match folder { Some(folder) => add_selected(vec![folder], &app.state::<LibraryState>()), None => Ok(Vec::new()) }
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn open_dropped(paths: Vec<String>, app: tauri::AppHandle) -> Result<Vec<MarkdownDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let mut selected = Vec::new();
        {
            let mut pending = state.pending_drops.lock().map_err(|_| "Seleção indisponível.")?;
            for path in paths {
                let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
                if !pending.remove(&path) { return Err("Arraste o arquivo para a janela ou use Abrir arquivo.".into()); }
                selected.push(path);
            }
        }
        add_selected(selected, &state)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn library_roots(state: State<'_, LibraryState>) -> Result<Vec<String>, String> {
    let registry = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?;
    Ok(registry.roots.iter().map(|path| path.to_string_lossy().into_owned()).collect())
}
#[tauri::command]
async fn restore_library(app: tauri::AppHandle) -> Result<Vec<MarkdownDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let files = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?.files.clone();
        Ok(files.iter().filter_map(|path| allowed_path(&path.to_string_lossy(), &state).ok().and_then(|safe| library_document(&safe, &state).ok())).collect())
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn read_document(path: String, app: tauri::AppHandle) -> Result<MarkdownDocument, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let safe = allowed_path(&path, &state)?;
        let doc = library_document(&safe, &state)?;
        let mut registry = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?;
        if !registry.files.contains(&safe) {
            let mut next = registry.clone(); next.files.push(safe); save_registry(&next, &state.storage)?; *registry = next;
        }
        Ok(doc)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_document(path: String, content: String, expected_content: String, app: tauri::AppHandle) -> Result<MarkdownDocument, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let safe = allowed_path(&path, &state)?;
        let registry = state.registry.lock().map_err(|_| "Biblioteca indisponível.")?;
        if !registry.files.contains(&safe) { return Err("Abra o documento na biblioteca antes de editá-lo.".into()); }
        let backups = state.storage.parent().ok_or("Pasta de recuperação indisponível.")?.join("backups");
        write_document(&safe, &content, &expected_content, &backups)?;
        library_document(&safe, &state)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn read_image(path: String, app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let safe = allowed_path(&path, &app.state::<LibraryState>())?;
        let mime = match safe.extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase().as_str() {
            "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp",
            _ => return Err("Formato de imagem não suportado. Use PNG, JPEG, GIF ou WebP.".into()),
        };
        if fs::metadata(&safe).map_err(|e| e.to_string())?.len() > IMAGE_LIMIT { return Err("Imagem excede 12 MB.".into()); }
        let bytes = fs::read(safe).map_err(|e| e.to_string())?;
        Ok(format!("data:{};base64,{}", mime, STANDARD.encode(bytes)))
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) { return Err("Endereço externo inválido.".into()); }
    webbrowser::open(&url).map_err(|e| e.to_string())
}

pub fn run() {
    let mut context = tauri::generate_context!();
    let portable = std::env::current_exe().ok().and_then(|exe| portable_data_dir(&exe));
    if let Some(folder) = &portable {
        context.config_mut().app.app_directories_override = Some(tauri::utils::config::AppDirectoriesOverride::Root(folder.clone()));
        if let Some(window) = context.config_mut().app.windows.first_mut() { window.title = "Noetia · Portátil".into(); }
    }
    tauri::Builder::default()
        .setup(move |app| {
            let folder = app.path().app_data_dir()?;
            fs::create_dir_all(&folder)?;
            let storage = folder.join("library.json");
            let mut registry: Registry = fs::read(&storage).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
            let portable_root = portable.as_ref().and_then(|folder| folder.parent()).map(fs::canonicalize).transpose()?;
            if let Some(root) = &portable_root { if relocate_portable_registry(&mut registry, root) { save_registry(&registry, &storage)?; } }
            app.manage(LibraryState { registry: Mutex::new(registry), pending_drops: Mutex::new(HashSet::new()), storage, portable_root });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let state = window.state::<LibraryState>();
                if let Ok(mut pending) = state.pending_drops.lock() {
                    pending.clear();
                    pending.extend(paths.iter().filter_map(|path| fs::canonicalize(path).ok()));
                };
            }
        })
        .invoke_handler(tauri::generate_handler![pick_documents, pick_folder, open_dropped, library_roots, restore_library, read_document, save_document, read_image, open_external])
        .run(context)
        .expect("Não foi possível iniciar o Noetia");
}

#[cfg(test)]
mod tests {
    use super::*;
    struct TestWorkspace(PathBuf);
    impl TestWorkspace {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("noetia-editor-tests-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
            fs::create_dir(&root).unwrap(); Self(root)
        }
    }
    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            // Only remove this test's direct, uniquely named child of the system temp directory.
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            assert!(self.0.file_name().unwrap().to_string_lossy().starts_with("noetia-editor-tests-"));
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn saves_markdown_and_keeps_original_recovery_copy() {
        let workspace = TestWorkspace::new(); let path = workspace.0.join("nota.md"); let backups = workspace.0.join("backups");
        fs::write(&path, "# Original\r\nTexto\r\n").unwrap();
        let saved = write_document(&path, "# Editada\r\nMais texto\r\n", "# Original\r\nTexto\r\n", &backups).unwrap();
        assert_eq!(saved.content, "# Editada\r\nMais texto\r\n");
        assert_eq!(fs::read_to_string(&path).unwrap(), saved.content);
        let backup = fs::read_dir(&backups).unwrap().next().unwrap().unwrap().path();
        assert_eq!(fs::read_to_string(backup).unwrap(), "# Original\r\nTexto\r\n");
        assert_eq!(fs::read_dir(&workspace.0).unwrap().count(), 2);
    }
    #[test]
    fn refuses_external_changes_and_oversized_updates_without_touching_the_file() {
        let workspace = TestWorkspace::new(); let path = workspace.0.join("nota.md"); let backups = workspace.0.join("backups");
        fs::write(&path, "Alteração externa").unwrap();
        assert!(write_document(&path, "Rascunho", "Original", &backups).err().unwrap().contains("mudou"));
        let too_large = "x".repeat(DOCUMENT_LIMIT as usize + 1);
        assert!(write_document(&path, &too_large, "Alteração externa", &backups).err().unwrap().contains("8 MB"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "Alteração externa");
        assert!(!backups.exists());
        assert_eq!(fs::read_dir(&workspace.0).unwrap().count(), 1);
    }
    #[test]
    fn denies_canonical_paths_outside_registered_roots() {
        let workspace = TestWorkspace::new(); let root = workspace.0.join("docs"); fs::create_dir(&root).unwrap();
        let inside = root.join("nota.md"); let outside = workspace.0.join("outra.md");
        fs::write(&inside, "Nota").unwrap(); fs::write(&outside, "Outra").unwrap();
        let safe = fs::canonicalize(&inside).unwrap();
        let state = LibraryState { registry: Mutex::new(Registry { roots: vec![fs::canonicalize(&root).unwrap()], files: vec![safe.clone()], portable_origin: None }), pending_drops: Mutex::new(HashSet::new()), storage: workspace.0.join("library.json"), portable_root: None };
        assert_eq!(allowed_path(&inside.to_string_lossy(), &state).unwrap(), safe);
        assert!(allowed_path(&outside.to_string_lossy(), &state).is_err());
    }
    #[test]
    fn recognizes_markdown_extensions_only() {
        assert!(markdown(Path::new("notes.MD")));
        assert!(markdown(Path::new("notes.markdown")));
        assert!(!markdown(Path::new("notes.md.exe")));
    }
    #[test]
    fn paths_use_components_not_string_prefixes() {
        assert!(!Path::new("workspace-other/secret.md").starts_with(Path::new("workspace")));
        assert!(Path::new("workspace/docs/readme.md").starts_with(Path::new("workspace")));
    }
    #[test]
    fn portable_mode_requires_a_marker_beside_the_executable() {
        let workspace = TestWorkspace::new(); let exe = workspace.0.join("Noetia.exe");
        assert!(portable_data_dir(&exe).is_none());
        fs::write(workspace.0.join("noetia.portable"), "1").unwrap();
        assert_eq!(portable_data_dir(&exe), Some(workspace.0.join("NoetiaData")));
    }
    #[test]
    fn moving_a_portable_folder_rebases_only_its_internal_paths() {
        let mut registry = Registry { roots: vec![PathBuf::from("old/Exemplos"), PathBuf::from("elsewhere/Docs")], files: vec![PathBuf::from("old/Exemplos/a.md"), PathBuf::from("old-other/a.md")], portable_origin: Some(PathBuf::from("old")) };
        assert!(relocate_portable_registry(&mut registry, Path::new("new")));
        assert_eq!(registry.roots, vec![PathBuf::from("new/Exemplos"), PathBuf::from("elsewhere/Docs")]);
        assert_eq!(registry.files, vec![PathBuf::from("new/Exemplos/a.md"), PathBuf::from("old-other/a.md")]);
        assert!(!relocate_portable_registry(&mut registry, Path::new("new")));
    }
    #[test]
    fn portable_internal_documents_keep_their_identity_after_moving() {
        let workspace = TestWorkspace::new();
        let root = fs::canonicalize(&workspace.0).unwrap();
        let folder = root.join("Exemplos"); fs::create_dir(&folder).unwrap();
        let path = folder.join("ideias.md"); fs::write(&path, "# Ideias").unwrap();
        let state = LibraryState { registry: Mutex::new(Registry::default()), pending_drops: Mutex::new(HashSet::new()), storage: root.join("NoetiaData/library.json"), portable_root: Some(root.clone()) };
        assert_eq!(library_document(&path, &state).unwrap().id, "portable:Exemplos/ideias.md");
        let mut standard = state; standard.portable_root = None;
        assert_eq!(library_document(&path, &standard).unwrap().id, path.to_string_lossy());
    }
    #[test]
    fn old_library_registries_remain_compatible() {
        let registry: Registry = serde_json::from_str(r#"{"roots":[],"files":[]}"#).unwrap();
        assert!(registry.portable_origin.is_none());
    }
}
