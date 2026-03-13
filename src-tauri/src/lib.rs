use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  WebviewWindow,
};

#[tauri::command]
fn set_widget_mode(app: tauri::AppHandle, enabled: bool) {
  if let Some(window) = app.get_webview_window("main") {
      if enabled {
          let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 560.0 }));
          let _ = window.set_always_on_top(true);
      } else {
          let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1600.0, height: 960.0 }));
          let _ = window.set_always_on_top(false);
          let _ = window.center();
      }
  }
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
      let _ = window.hide();
  }
}

#[tauri::command]
fn close_window(app: tauri::AppHandle) {
  app.exit(0);
}

#[tauri::command]
fn show_window(app: tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
      let _ = window.show();
      let _ = window.set_focus();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
      .plugin(tauri_plugin_shell::init())
      .plugin(tauri_plugin_notification::init())
      .invoke_handler(tauri::generate_handler![set_widget_mode, hide_window, close_window, show_window])
      .setup(|app| {
          let show = MenuItem::with_id(app, "show", "Show BASE", true, None::<&str>)?;
          let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
          let menu = Menu::with_items(app, &[&show, &quit])?;

          TrayIconBuilder::new()
              .menu(&menu)
              .show_menu_on_left_click(false)
              .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                  "show" => {
                      if let Some(window) = app.get_webview_window("main") {
                          let _ = WebviewWindow::show(&window);
                          let _ = WebviewWindow::set_focus(&window);
                      }
                  }
                  "quit" => app.exit(0),
                  _ => {}
              })
              .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                  if let TrayIconEvent::Click {
                      button: MouseButton::Left,
                      button_state: MouseButtonState::Up,
                      ..
                  } = event {
                      let app = tray.app_handle();
                      if let Some(window) = app.get_webview_window("main") {
                          let _ = WebviewWindow::show(&window);
                          let _ = WebviewWindow::set_focus(&window);
                      }
                  }
              })
              .build(app)?;

          Ok(())
      })
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
}