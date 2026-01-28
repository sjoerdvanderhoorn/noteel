// Responsive layout management

import { state } from "../core/state.js";

export function getResponsiveMode() {
  const width = window.innerWidth;
  if (width <= 640) return "phone"; // One panel at a time
  if (width <= 1024) return "tablet"; // Two panels
  return "desktop"; // Three panels
}

export function updateResponsiveLayout() {
  const mode = getResponsiveMode();
  const layout = document.querySelector(".layout");
  const sidebar = document.querySelector(".sidebar");
  const list = document.querySelector(".list");
  const editor = document.querySelector(".editor");
  
  // Get UI elements
  const listBackBtn = document.getElementById("listBackBtn");
  const editorBackBtn = document.getElementById("editorBackBtn");
  
  // Remove all responsive classes
  layout.classList.remove("responsive-phone", "responsive-tablet");
  sidebar.classList.remove("panel-hidden");
  list.classList.remove("panel-hidden");
  editor.classList.remove("panel-hidden");
  
  // Show/hide back buttons based on mode
  listBackBtn.style.display = mode === "phone" ? "block" : "none";
  editorBackBtn.style.display = (mode === "phone" || mode === "tablet") ? "block" : "none";
  
  if (mode === "phone") {
    // Phone: Show one panel at a time
    layout.classList.add("responsive-phone");
    
    if (state.currentFile) {
      // Editing: show only editor
      sidebar.classList.add("panel-hidden");
      list.classList.add("panel-hidden");
    } else if (state.phoneShowingList) {
      // List panel showing: hide sidebar and editor
      sidebar.classList.add("panel-hidden");
      editor.classList.add("panel-hidden");
    } else {
      // Default: show sidebar (folder panel)
      list.classList.add("panel-hidden");
      editor.classList.add("panel-hidden");
    }
  } else if (mode === "tablet") {
    // Tablet: Show two panels (folder + list) or editor fullscreen
    layout.classList.add("responsive-tablet");
    
    if (state.currentFile || layout.classList.contains("masonry-editing")) {
      // Editing: show only editor fullscreen
      sidebar.classList.add("panel-hidden");
      list.classList.add("panel-hidden");
    } else {
      // Browsing: show sidebar + list
      editor.classList.add("panel-hidden");
    }
  }
  // Desktop: show all three panels (no changes needed)
}
