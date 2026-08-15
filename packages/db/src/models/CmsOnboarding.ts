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
    whyItMattersHeading?: string;
    imageUrl?: string;
    imageAlt?: string;
  };
}

export interface ICmsOnboardingDocument extends Document {
  steps: ICmsOnboardingStep[];
  globalSettings?: {
    emptyStateTitle?: string;
    emptyStateText?: string;
    emptyStateButtonText?: string;
    completionButtonText?: string;
    relationshipOptions?: string[];
  };
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
      whyItMattersHeading: String,
      imageUrl: String,
      imageAlt: String,
    },
  },
  { _id: false }
);

const CmsOnboardingSchema = new Schema<ICmsOnboardingDocument>(
  {
    steps: { type: [CmsOnboardingStepSchema], default: [] },
    globalSettings: {
      emptyStateTitle: { type: String, default: 'Welcome to PawTag!' },
      emptyStateText: { type: String, default: 'Your account is ready. Head to your dashboard to get started.' },
      emptyStateButtonText: { type: String, default: 'Go to My Dashboard' },
      completionButtonText: { type: String, default: 'Go to My Dashboard' },
      relationshipOptions: { type: [String], default: ['Spouse', 'Partner', 'Fiancé', 'Ex-Spouse', 'Ex-Partner', 'Parent', 'Stepparent', 'Parent-in-law', 'Grandparent', 'Sibling', 'Step-Sibling', 'Sibling-in-law', 'Child', 'Stepchild', 'Child-in-law', 'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Godparent', 'Godchild', 'Friend', 'Neighbour', 'Housemate', 'Work Colleague', 'Manager', 'Client', 'Mentor', 'Teacher', 'Caregiver', 'Other'] },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const CmsOnboarding = mongoose.models.CmsOnboarding || mongoose.model<ICmsOnboardingDocument>(
  'CmsOnboarding',
  CmsOnboardingSchema
);

export default CmsOnboarding;
