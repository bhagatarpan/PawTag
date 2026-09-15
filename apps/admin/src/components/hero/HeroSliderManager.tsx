import { useState, useEffect, useCallback } from 'react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import {
  Plus, Trash2, Copy, Eye, EyeOff, GripVertical,
  ArrowUp, ArrowDown, Loader2, Image as ImageIcon
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HeroSlide {
  _id: string;
  sectionType: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  order: number;
  isActive: boolean;
  status?: 'draft' | 'published';
  duration?: number;
  transition?: string;
  thumbnail?: string;
  createdAt: string;
}

// ─── Sortable Slide Row ────────────────────────────────────────────

function SortableSlideRow({
  slide,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}: {
  slide: HeroSlide;
  onEdit: (slide: HeroSlide) => void;
  onDuplicate: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 0,
  };

  const headline = (slide.content as Record<string, unknown>)?.headline as string || slide.title;
  const visualType = (slide.content as Record<string, unknown>)?.visualType as string || 'paw';
  const bg = (slide.content as Record<string, unknown>)?.bg as string || 'from-primary-700 via-primary-600 to-primary-800';

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 transition-colors ${isDragging ? 'bg-primary-50 shadow-lg' : ''}`}
    >
      <td className="px-2 py-3 w-8">
        <button
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-3 py-3 w-12 text-sm text-gray-500">
        {slide.order + 1}
      </td>
      <td className="px-3 py-3 w-20">
        <div
          className={`w-16 h-10 rounded bg-gradient-to-r ${bg} flex items-center justify-center`}
        >
          <span className="text-white text-[10px] font-medium truncate px-1">
            {visualType}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 text-sm">{headline}</div>
        <div className="text-xs text-gray-500 mt-0.5">{slide.title}</div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          slide.isActive
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {slide.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          slide.status === 'published'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {slide.status === 'published' ? 'Published' : 'Draft'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(slide)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDuplicate(slide._id)}
            className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-gray-100 transition-colors"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={() => onToggleActive(slide._id)}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-gray-100 transition-colors"
            title={slide.isActive ? 'Deactivate' : 'Activate'}
          >
            {slide.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            onClick={() => onDelete(slide._id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function HeroSliderManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Form state for create/edit
  const [formTitle, setFormTitle] = useState('');
  const [formHeadline, setFormHeadline] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchSlides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(API.admin.cms.homepage.list, {
        params: { sectionType: 'hero_slide' },
      });
      setSlides(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch slides:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSlides(); }, [fetchSlides]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s._id === active.id);
    const newIndex = slides.findIndex((s) => s._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(slides, oldIndex, newIndex);
    setSlides(reordered);

    // Persist to server
    setReorderSaving(true);
    const items = reordered.map((s, i) => ({ id: s._id, order: i }));
    api.put(API.admin.cms.homepage.reorder, { items })
      .catch(() => setSlides(slides)) // Revert on failure
      .finally(() => setReorderSaving(false));
  }, [slides]);

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    try {
      await api.post(API.admin.cms.homepage.create, {
        sectionType: 'hero_slide',
        title: formTitle,
        content: {
          headline: formHeadline || formTitle,
          sub: formSubtitle,
          tag: 'New',
          ctaText: 'Learn More',
          ctaUrl: '/shop',
          bg: 'from-primary-700 via-primary-600 to-primary-800',
          visualType: 'paw',
          duration: 5,
          stats: [],
          flowSteps: [],
          imageUrl: '',
          imageAlt: '',
        },
        order: slides.length,
        isActive: false,
        status: formStatus,
      });
      setIsCreating(false);
      setFormTitle('');
      setFormHeadline('');
      setFormSubtitle('');
      setFormStatus('draft');
      fetchSlides();
    } catch (err) {
      console.error('Failed to create slide:', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(API.admin.cms.homepage.duplicate(id));
      fetchSlides();
    } catch (err) {
      console.error('Failed to duplicate slide:', err);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await api.put(API.admin.cms.homepage.toggle(id));
      fetchSlides();
    } catch (err) {
      console.error('Failed to toggle slide:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    try {
      await api.delete(API.admin.cms.homepage.delete(id));
      fetchSlides();
    } catch (err) {
      console.error('Failed to delete slide:', err);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'draft' | 'published') => {
    try {
      await api.put(API.admin.cms.homepage.update(id), { status });
      fetchSlides();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hero Slider</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your homepage hero slides</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Create New Slide
        </button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Hero Slide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Hero Slide 1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
              <input
                type="text"
                value={formHeadline}
                onChange={(e) => setFormHeadline(e.target.value)}
                placeholder="e.g., Welcome to PawTag"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <input
                type="text"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder="e.g., Protect your pets with smart QR tags"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={!formTitle.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              Create Slide
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Slide List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading slides...</p>
        </div>
      ) : slides.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hero slides yet. Create your first slide to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-3 w-8"></th>
                <th className="px-3 py-3 w-12 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-3 py-3 w-20 text-left text-xs font-medium text-gray-500 uppercase">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map((s) => s._id)} strategy={verticalListSortingStrategy}>
                  {slides.map((slide) => (
                    <SortableSlideRow
                      key={slide._id}
                      slide={slide}
                      onEdit={(s) => setEditingSlide(s)}
                      onDuplicate={handleDuplicate}
                      onToggleActive={handleToggleActive}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          </table>

          {reorderSaving && (
            <div className="px-4 py-2 bg-primary-50 border-t border-primary-100 text-xs text-primary-600 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Saving display order...
            </div>
          )}
        </div>
      )}

      {/* Edit Modal Placeholder - Will be implemented in Phase 2 */}
      {editingSlide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingSlide(null)}>
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Edit Slide: {editingSlide.title}</h2>
              <button onClick={() => setEditingSlide(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">
                WYSIWYG editor will be implemented in Phase 2.
                <br />
                For now, you can edit slides through the existing Homepage Sections page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
