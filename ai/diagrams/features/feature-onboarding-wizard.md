# Onboarding & Guided Setup

**Type:** Feature Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(onboarding)/onboarding/page.tsx`
- `apps/dashboard/src/app/api/onboarding/route.ts`
- `apps/dashboard/src/components/onboarding/onboarding-checklist.tsx`
- `apps/dashboard/src/components/dashboard/welcome-banner.tsx`

## Purpose

Guides new developers through first-time setup — from signup to first scanned session — ensuring they experience value quickly.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        NewUser[New User Signs Up] --> Onboarding[Onboarding Wizard ✅ Step-by-step]
        Onboarding --> Step1[Create Workspace ✅]
        Step1 --> Step2[Connect Sessions 🎯 Local or SSH]
        Step2 --> Step3[First Scan ⚡]
        Step3 --> Step4[Style Profile 🎯 Teach AI your voice]
        Step4 --> Dashboard[Dashboard Home]
        Dashboard --> WelcomeBanner[Welcome Banner ✅ Remaining steps]
        Dashboard --> Checklist[Sidebar Checklist 📊 Dismissable via localStorage]
    end

    subgraph "Back-Stage (Implementation)"
        Step1 --> WorkspaceAPI[Workspace Create 💾]
        Step2 --> ScanConfig[Scan Config 💾]
        Step3 --> ScanPipeline[Scanner ⚡]
        Step4 --> StyleAPI[Style Profile Generator 🎯]
        Checklist --> LocalStorage[localStorage 💾]
    end

    Dashboard -->|0 Sessions| EmptyCTA[Get Started CTA ✅]
    Step2 -->|No Sessions Found| HelpText[Setup Help ✅]
```

## Key Insights

- **Progressive Disclosure**: Wizard reveals complexity gradually
- **Multiple Empty States**: Dashboard, Sessions, Insights pages all have onboarding-aware CTAs
- **Known Bug**: Dashboard welcome banner links to `/{workspace}/onboarding` instead of `/onboarding`

## Change History

- **2026-03-18:** Initial creation — includes audit finding about wrong onboarding link
