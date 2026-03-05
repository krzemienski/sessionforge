"use client";

import { useState, useCallback, useEffect } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragDropReorderProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  emptyState?: React.ReactNode;
}

export function DragDropReorder<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
  emptyState,
}: DragDropReorderProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localItems, setLocalItems] = useState<T[]>(items);

  // Update local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      const newList = [...localItems];
      const draggedItem = newList[draggedIndex];
      newList.splice(draggedIndex, 1);
      newList.splice(index, 0, draggedItem);
      setLocalItems(newList);
      setDraggedIndex(index);
    },
    [draggedIndex, localItems]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    if (localItems !== items) {
      onReorder(localItems);
    }
  }, [localItems, items, onReorder]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {localItems.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-center gap-3 bg-sf-bg-tertiary border border-sf-border rounded-sf p-3 cursor-move transition-all",
            draggedIndex === index && "opacity-50",
            "hover:border-sf-border-focus",
            itemClassName
          )}
        >
          <div className="text-sf-text-muted flex-shrink-0">
            <GripVertical size={16} />
          </div>
          <div className="flex-1 min-w-0">{renderItem(item, index)}</div>
        </div>
      ))}
    </div>
  );
}
