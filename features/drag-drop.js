// Drag and drop functionality for reordering notes

import { loadFs, saveFs } from "../core/storage.js";
import { state } from "../core/state.js";

export function setupDragAndDrop(card, path, filtered, renderNotesFn) {
  card.draggable = true;
  
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", path);
    card.classList.add("dragging");
  });
  
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });
  
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    const dragging = document.querySelector(".dragging");
    if (!dragging || dragging === card) return;
    
    card.classList.add("drag-over");
  });
  
  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });
  
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    
    const draggedPath = e.dataTransfer.getData("text/plain");
    const targetPath = card.dataset.path;
    
    if (draggedPath === targetPath) return;
    
    // Update order in .noteel file
    const noteelPath = state.currentFolder ? `${state.currentFolder}/.noteel` : ".noteel";
    const fs = loadFs();
    
    let config = { view: state.viewMode };
    if (fs.files[noteelPath]) {
      try {
        config = JSON.parse(fs.files[noteelPath].content);
      } catch {
        config = { view: state.viewMode };
      }
    }
    
    // Create or update order array
    const allFilenames = filtered.map(p => p.split("/").pop());
    const draggedFilename = draggedPath.split("/").pop();
    const targetFilename = targetPath.split("/").pop();
    
    // Remove dragged item and insert at target position
    const newOrder = allFilenames.filter(f => f !== draggedFilename);
    const targetIdx = newOrder.indexOf(targetFilename);
    newOrder.splice(targetIdx, 0, draggedFilename);
    
    config.order = newOrder;
    fs.files[noteelPath] = {
      content: JSON.stringify(config, null, 2),
      modified: Date.now()
    };
    saveFs(fs);
    
    renderNotesFn();
  });
}
