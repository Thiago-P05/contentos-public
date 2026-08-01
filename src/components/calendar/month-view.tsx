"use client";

import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { clsx } from "clsx";
import { PublishModal } from "./publish-modal";
import { PlatformIcon } from "@/components/platform-icon";
import type { PlatformConnection, ContentListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function MonthView({ connections, items = [] }: { connections: PlatformConnection[], items?: ContentListItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const handleOpenModal = (presetDate: Date | null = null) => {
    setSelectedDate(presetDate);
    setIsModalOpen(true);
  };

  return (
    <div className="relative flex w-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface p-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold capitalize tracking-display text-foreground">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={today} variant="secondary" size="sm">
            Hoy
          </Button>
          <div className="flex items-center overflow-hidden rounded-md bg-surface shadow-[var(--shadow-ring-light)]">
            <Button onClick={prevMonth} variant="ghost" size="icon" className="rounded-none" aria-label="Mes anterior">
              <ChevronLeft />
            </Button>
            <Button onClick={nextMonth} variant="ghost" size="icon" className="rounded-none" aria-label="Mes siguiente">
              <ChevronRight />
            </Button>
          </div>
          <Button onClick={() => handleOpenModal(null)} className="ml-4">
            <Plus />
            Programar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-surface">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="py-3 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid auto-rows-fr grid-cols-7 bg-background">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
            className={clsx(
                "group flex min-h-[140px] cursor-pointer flex-col p-2 shadow-[var(--shadow-border)] transition-colors",
                !isCurrentMonth ? "bg-surface hover:bg-surface-elevated" : "bg-background hover:bg-surface/50",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex justify-between items-start">
                <span
                  className={clsx(
                    "text-sm flex items-center justify-center min-w-[28px] h-7 px-1 rounded-full font-medium",
                    isCurrentDay
                      ? "bg-foreground text-background"
                      : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground opacity-50"
                  )}
                >
                  {format(day, "d")}
                </span>
                
                {/* Botón flotante para subir contenido ese día */}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenModal(day); }}
                  className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground opacity-0 shadow-[var(--shadow-ring-light)] transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  + Añadir
                </button>
              </div>
              
              {/* Espacio para los eventos/posteos (Vacío hasta conectar Supabase) */}
              <div className="flex-1 mt-2 space-y-1.5 overflow-y-auto no-scrollbar pb-1">
                {items
                  .filter((item) => new Date(item.publishedAt).toDateString() === day.toDateString())
                  .map((item) => (
                    <a 
                      key={item.id}
                      href={item.permalink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full truncate rounded-sm bg-surface px-2 py-1 text-left text-label font-medium text-foreground/80 shadow-[var(--shadow-ring-light)] transition-colors hover:bg-surface-elevated hover:text-foreground sm:text-xs"
                      title={item.caption || "Contenido"}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <PlatformIcon platform={item.platform} className="w-3 h-3 text-foreground/70 shrink-0" />
                        <span className="truncate">{item.caption || (item.platform === "instagram" ? "Reel" : "Post")}</span>
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <PublishModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        preselectedDate={selectedDate} 
        connections={connections}
      />
    </div>
  );
}
