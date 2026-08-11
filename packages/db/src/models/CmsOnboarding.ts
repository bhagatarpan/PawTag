import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsOnboardingStep {
  stepId: string;
  title: string;
  subtitle: string;
  icon: string;
  order: number;
  isActive: boolean;
  type: 'info' | 'form';
  formFields?: string[];
  content?: {
    stats?: Array<{ number: string; label: string }>;
    storyText?: string;
    storyHeading?: string;
    flowSteps?: Array<{ icon: string; label: string; description: string }>;
    callout?: {
      icon: string;
      title: string;
      text: string;
      variant: 'warning' | 'info' | 'tip';
    };
    privacyNote?: {
      icon: string;
      title: string;
      text: string;
    };
    whyItMatters?: string;
    imageUrl?: string;
    imageAlt?: string;
  };
}

export interface ICmsOnboardingDocument extends Document {
  steps: ICmsOnboardingStep[];
  updatedBy: mongoose.Types.ObjectId;
}

const CmsOnboardingStepSchema = new Schema<ICmsOnboardingStep>(
  {
    stepId: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: 'Heart' },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
    type: { type: String, enum: ['info', 'form'], default: 'info' },
    formFields: [{ type: String }],
    content: {
      stats: [{
        number: String,
        label: String,
      }],
      storyText: String,
      storyHeading: String,
      flowSteps: [{
        icon: String,
        label: String,
        description: String,
      }],
      callout: {
        icon: String,
        title: String,
        text: String,
        variant: { type: String, enum: ['warning', 'info', 'tip'] },
      },
      privacyNote: {
        icon: String,
        title: String,
        text: String,
      },
      whyItMatters: String,
      imageUrl: String,
      imageAlt: String,
    },
  },
  { _id: false }
);

const CmsOnboardingSchema = new Schema<ICmsOnboardingDocument>(
  {
    steps: { type: [CmsOnboardingStepSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const CmsOnboarding = mongoose.models.CmsOnboarding || mongoose.model<ICmsOnboardingDocument>(
  'CmsOnboarding',
  CmsOnboardingSchema
);

export default CmsOnboarding;
