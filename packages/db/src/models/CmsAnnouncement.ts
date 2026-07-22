import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsAnnouncementDocument extends Document {
  title: string;
  message: string;
  type: 'banner' | 'popup' | 'maintenance' | 'promotion' | 'support';
  priority: number;
  status: 'draft' | 'published' | 'archived';
  startsAt?: Date;
  endsAt?: Date;
  link?: string;
  linkText?: string;
  dismissible: boolean;
  visible: boolean;
  targetAudience?: 'all' | 'logged_in' | 'logged_out';
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsAnnouncementSchema = new Schema<ICmsAnnouncementDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: ['banner', 'popup', 'maintenance', 'promotion', 'support'], required: true, index: true },
    priority: { type: Number, default: 0, index: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    startsAt: { type: Date, index: true },
    endsAt: { type: Date },
    link: { type: String },
    linkText: { type: String, maxlength: 100 },
    dismissible: { type: Boolean, default: true },
    visible: { type: Boolean, default: true },
    targetAudience: { type: String, enum: ['all', 'logged_in', 'logged_out'], default: 'all' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsAnnouncementSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
CmsAnnouncementSchema.index({ deletedAt: 1 });

export const CmsAnnouncement = mongoose.model<ICmsAnnouncementDocument>('CmsAnnouncement', CmsAnnouncementSchema);
