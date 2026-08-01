"use client";

import { X, UploadCloud, CalendarClock, ChevronDown, Check } from "lucide-react";
import { useRef, useState } from "react";
import { clsx } from "clsx";
import { resolvePreferredConnectionId } from "@/lib/preferred-connection";
import type { PlatformConnection } from "@/lib/types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDate: Date | null;
  connections: PlatformConnection[];
}

export function PublishModal({ isOpen, onClose, preselectedDate, connections }: PublishModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [caption, setCaption] = useState("");
  const [targetAccountId, setTargetAccountId] = useState<string | null>(
    () => resolvePreferredConnectionId(connections, null),
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined | null) => {
    if (file) setSelectedFile(file);
    setDragActive(false);
  };

  const effectiveTargetAccountId =
    targetAccountId === ""
      ? ""
      : resolvePreferredConnectionId(connections, targetAccountId) ?? "";

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!selectedFile || !effectiveTargetAccountId) {
      alert("Por favor selecciona una cuenta y un archivo.");
      return;
    }
    
    setIsPublishing(true);
    try {
      // En vez del binario gigante, mandamos la data para que el loguee la simulación
      const formData = new FormData();
      formData.append("fileName", selectedFile.name);
      formData.append("fileSize", selectedFile.size.toString());
      formData.append("accountId", effectiveTargetAccountId);
      formData.append("caption", caption);
      if (preselectedDate) {
        formData.append("scheduledDate", preselectedDate.toISOString());
      }

      const res = await fetch("/api/calendar/publish", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error en la subida");
      
      alert("¡Contenido encolado y agendado con éxito!");
      onClose();
    } catch (err) {
      alert("Hubo un error al publicar el contenido.");
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end modal-scrim backdrop-blur-sm transition-all duration-300">
      <div 
        className="w-full max-w-md h-full bg-surface border-l border-line flex flex-col shadow-2xl ds-animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Programar Contenido</h2>
            {preselectedDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Para el {preselectedDate.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long" })}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-elevated rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Target Account Selector (Custom Dropdown) */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-2">Cuenta Destino</label>
            <div 
              className="w-full bg-surface text-foreground border border-line rounded-lg px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className={clsx(!effectiveTargetAccountId && "text-muted-foreground")}>
                {effectiveTargetAccountId
                  ? (() => {
                      const c = connections.find((x) => x.id === effectiveTargetAccountId);
                      return c ? `${c.platform.charAt(0).toUpperCase() + c.platform.slice(1)} - @${c.accountUsername}` : "Selecciona una cuenta...";
                    })()
                  : "Selecciona una cuenta..."}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
            
            {isDropdownOpen && (
              <div className="absolute z-10 mt-2 w-full bg-surface-elevated border border-line rounded-lg shadow-2xl py-1 overflow-hidden ds-animate-in fade-in slide-in-from-top-2 duration-200">
                <div 
                  className={clsx(
                    "px-4 py-2 text-sm flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors",
                    !effectiveTargetAccountId ? "text-foreground bg-surface-hover" : "text-muted-foreground"
                  )}
                  onClick={() => { setTargetAccountId(""); setIsDropdownOpen(false); }}
                >
                  <span>Selecciona una cuenta...</span>
                  {!effectiveTargetAccountId && <Check className="w-4 h-4 text-foreground" />}
                </div>
                {connections.map((conn) => {
                  const isSelected = effectiveTargetAccountId === conn.id;
                  return (
                    <div 
                      key={conn.id}
                      className={clsx(
                        "px-4 py-2 text-sm flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors",
                        isSelected ? "text-foreground bg-surface-hover" : "text-foreground"
                      )}
                      onClick={() => { setTargetAccountId(conn.id); setIsDropdownOpen(false); }}
                    >
                      <span>{conn.platform.charAt(0).toUpperCase() + conn.platform.slice(1)} - @{conn.accountUsername}</span>
                      {isSelected && <Check className="w-4 h-4 text-foreground" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Media Dropzone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Media (Video/Imagen)</label>
            {!selectedFile ? (
              <div 
                className={clsx(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
                  dragActive ? "border-line-accent bg-surface-elevated" : "border-line hover:border-line-strong hover:bg-surface-elevated/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="video/mp4,image/jpeg,image/png" 
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <div className="w-12 h-12 bg-surface-elevated rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Haz clic o arrastra tu archivo aquí</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, JPEG o PNG (Max. 100MB)</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-surface-elevated border border-line rounded-xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center shrink-0 border border-line">
                    <span className="text-xs font-bold text-muted-foreground uppercase">
                      {selectedFile.name.split('.').pop()}
                    </span>
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-medium text-foreground truncate">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Caption Editor */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-foreground">Caption original</label>
            </div>
            <textarea 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escribe el descripcón de la publicación..."
              className="w-full h-32 bg-surface text-foreground border border-line rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-line-strong"
            />
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-line bg-surface/50 mt-auto flex items-center space-x-3">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isPublishing}
            className="flex-1 py-2.5 border border-line text-muted-foreground hover:text-foreground hover:bg-surface-elevated font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 bg-surface-elevated text-foreground border border-line font-semibold text-sm rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {isPublishing ? (
              <span className="flex items-center gap-2 animate-pulse">
                <UploadCloud className="w-4 h-4" />
                Subiendo...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                {preselectedDate ? "Programar" : "Publicar Ahora"}
              </span>
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
