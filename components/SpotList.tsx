'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { LocalSpot } from '@/lib/types';
import { getSpotColor } from '@/lib/spot-color';

type SpotListProps = {
  spots: LocalSpot[];
  onReorder: (newSpots: LocalSpot[]) => void;
  onDelete?: (id: string) => void;
};

type SortableItemProps = {
  spot: LocalSpot;
  index: number;
  total: number;
  onDelete?: (id: string) => void;
};

function SortableItem({ spot, index, total, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: spot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = getSpotColor(index, total);
  const canDrag = total > 1;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-black/[0.08] ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <button
        type="button"
        aria-label="드래그 핸들"
        className={`text-slate-400 flex-shrink-0 transition-colors ${
          canDrag
            ? 'cursor-grab active:cursor-grabbing hover:text-slate-600'
            : 'cursor-default opacity-30'
        }`}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
      >
        <GripVertical size={16} />
      </button>
      <span
        className="w-5 h-5 rounded-full flex-shrink-0 text-white text-[10px] font-bold flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        {index + 1}
      </span>
      <span className="flex-1 text-sm text-[#1A1A1A] truncate">{spot.name}</span>
      {onDelete && (
        <button
          type="button"
          aria-label="촬영지 삭제"
          onClick={() => onDelete(spot.id)}
          className="text-slate-300 hover:text-red-400 flex-shrink-0 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </li>
  );
}

export function SpotList({ spots, onReorder, onDelete }: SpotListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spots.findIndex((s) => s.id === active.id);
    const newIndex = spots.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(spots, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={spots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {spots.map((spot, i) => (
            <SortableItem
              key={spot.id}
              spot={spot}
              index={i}
              total={spots.length}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
