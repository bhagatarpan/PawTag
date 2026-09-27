import { useState } from 'react';
import { X, Plus, Star, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconPicker, type IFeatureHighlight } from '@pawtag/ui';

/* ------------------------------------------------------------------ */
/*  Color Palette                                                      */
/* ------------------------------------------------------------------ */

export const HIGHLIGHT_COLORS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  teal:   { label: 'Teal',   bg: 'bg-teal-50',   text: 'text-teal-800',   border: 'border-teal-200' },
  green:  { label: 'Green',  bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  amber:  { label: 'Amber',  bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200' },
  blue:   { label: 'Blue',   bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200' },
  purple: { label: 'Purple', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  red:    { label: 'Red',    bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200' },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface FeatureHighlightsEditorProps {
  value: IFeatureHighlight[];
  onChange: (items: IFeatureHighlight[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Sortable Row                                                       */
/* ------------------------------------------------------------------ */

function SortableFeatureRow({
  item,
  index,
  onUpdate,
  onRemove,
  onToggleHighlight,
}: {
  item: IFeatureHighlight;
  index: number;
  onUpdate: (index: number, field: 'icon' | 'description' | 'highlightColor', value: string) => void;
  onRemove: (index: number) => void;
  onToggleHighlight: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 ${isDragging ? 'bg-primary-50 rounded-lg shadow-lg' : ''}`}>
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 touch-none shrink-0"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <button
        type="button"
        onClick={() => onToggleHighlight(index)}
        className={`p-1 rounded transition-colors shrink-0 ${item.highlighted ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
        title={item.highlighted ? 'Remove highlight' : 'Highlight this feature'}
      >
        <Star size={16} fill={item.highlighted ? 'currentColor' : 'none'} />
      </button>
      <IconPicker
        value={item.icon}
        onChange={(icon) => onUpdate(index, 'icon', icon)}
        className="w-40 shrink-0"
      />
      <input
        value={item.description}
        onChange={(e) => onUpdate(index, 'description', e.target.value)}
        className="flex-1 border rounded-md px-3 py-2 text-sm"
        placeholder="e.g. Eligible for Free Shipping NZ Wide"
      />
      {item.highlighted && (
        <select
          value={item.highlightColor || 'teal'}
          onChange={(e) => onUpdate(index, 'highlightColor', e.target.value)}
          className="border rounded-md px-2 py-2 text-xs shrink-0"
        >
          {Object.entries(HIGHLIGHT_COLORS).map(([key, c]) => (
            <option key={key} value={key}>{c.label}</option>
          ))}
        </select>
      )}
      <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 p-1 shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function FeatureHighlightsEditor({ value, onChange }: FeatureHighlightsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const oldIndex = active.id as number;
    const newIndex = over.id as number;
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  const handleUpdate = (index: number, field: 'icon' | 'description' | 'highlightColor', fieldValue: string) => {
    const next = [...value];
    next[index] = { ...next[index], [field]: fieldValue };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, idx) => idx !== index));
  };

  const handleToggleHighlight = (index: number) => {
    const next = [...value];
    next[index] = { ...next[index], highlighted: !next[index].highlighted, highlightColor: next[index].highlightColor || 'teal' };
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...value, { icon: 'check', description: '', highlighted: false, highlightColor: 'teal' }]);
  };

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((_, i) => i)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((item, index) => (
              <SortableFeatureRow
                key={index}
                item={item}
                index={index}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onToggleHighlight={handleToggleHighlight}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button type="button" onClick={handleAdd} className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 font-medium">
        <Plus size={14} /> Add Feature
      </button>
    </div>
  );
}
