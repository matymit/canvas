// features/canvas/stores/modules/sectionModule.ts
import { nanoid } from 'nanoid';
import type { StoreSlice } from './types';
import type { ElementId, CanvasElement } from '../../../../../types/index';

export type SectionId = string;

export interface SectionElement {
  id: SectionId;
  type: 'section';
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  color?: string;
  visible?: boolean;
}

export interface SectionModuleState {
  sectionMembership: Map<ElementId, SectionId | null>;
}

export interface SectionModule {
  addSection: (
    section: Omit<SectionElement, 'id'> & Partial<Pick<SectionElement, 'id'>>
  ) => SectionId;
  updateSection: (
    id: SectionId,
    patch:
      | Partial<SectionElement>
      | ((current: SectionElement) => SectionElement)
  ) => void;
  removeSection: (id: SectionId) => void;

  setElementSection: (elementId: ElementId, sectionId: SectionId | null) => void;
  getSectionElements: (sectionId: SectionId) => ElementId[];
  autoFitSectionToContents: (
    sectionId: SectionId,
    padding?: number
  ) => void;
}

export const createSectionModule: StoreSlice<
  SectionModuleState & SectionModule
> = (set, get) => ({
  sectionMembership: new Map<ElementId, SectionId | null>(),

  addSection: (input: Omit<SectionElement, 'id'> & Partial<Pick<SectionElement, 'id'>>) => {
    const id = (input as any).id ?? (nanoid() as unknown as SectionId);
    const section = { ...input, id } as SectionElement;

    set((state) => {
      const current = state as any;
      const nextSections = new Map<SectionId, SectionElement>(
        current.sections ?? []
      );
      nextSections.set(id, section);
      current.sections = nextSections;
    });
    return id;
  },

  updateSection: (id: SectionId, patch: Partial<SectionElement> | ((current: SectionElement) => SectionElement)) => {
    set((state) => {
      const current = state as any;
      const sections =
        (current.sections as Map<SectionId, SectionElement> | undefined) ?? undefined;
      if (!sections || !sections.has(id)) return;

      const prev = sections.get(id)!;
      const next =
        typeof patch === 'function' ? (patch as any)(prev) : { ...prev, ...patch };

      const nextSections = new Map(sections);
      nextSections.set(id, next);
      current.sections = nextSections;
    });
  },

  removeSection: (id: SectionId) => {
    set((state) => {
      const current = state as any;
      const sections =
        (current.sections as Map<SectionId, SectionElement> | undefined) ?? undefined;
      if (!sections || !sections.has(id)) return;

      const nextSections = new Map(sections);
      nextSections.delete(id);

      const membership = new Map(
        (current.sectionMembership as Map<ElementId, SectionId | null>) ?? []
      );
      // Unassign elements that referenced this section
      Array.from(membership.entries()).forEach(([elId, sec]) => {
        if (sec === id) membership.set(elId, null);
      });

      current.sections = nextSections;
      current.sectionMembership = membership;
    });
  },

  setElementSection: (elementId: ElementId, sectionId: SectionId | null) => {
    set((state) => {
      const current = state as any;
      const membership = new Map(
        (current.sectionMembership as Map<ElementId, SectionId | null>) ?? []
      );
      membership.set(elementId, sectionId);
      current.sectionMembership = membership;
    });
  },

  getSectionElements: (sectionId: SectionId) => {
    const current = get() as any;
    const membership =
      (current.sectionMembership as Map<ElementId, SectionId | null>) ?? new Map();
    const result: ElementId[] = [];
    membership.forEach((sec, el) => {
      if (sec === sectionId) result.push(el);
    });
    return result;
  },

  autoFitSectionToContents: (sectionId: SectionId, padding = 16) => {
    const current = get() as any;
    const sections =
      (current.sections as Map<SectionId, SectionElement> | undefined) ?? undefined;
    if (!sections || !sections.has(sectionId)) return;

    const elements =
      (current.elements as Map<ElementId, CanvasElement> | undefined) ?? undefined;
    if (!elements) return;

    const memberIds = (get() as any).getSectionElements(sectionId) as ElementId[];
    if (memberIds.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const id of memberIds) {
      const el = elements.get(id);
      if (!el) continue;
      const x = (el as any).x ?? 0;
      const y = (el as any).y ?? 0;
      const w = (el as any).width ?? (el as any).w ?? 0;
      const h = (el as any).height ?? (el as any).h ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return;
    }

    set((state) => {
      const current = state as any;
      const sections = current.sections as Map<SectionId, SectionElement>;
      const nextSections = new Map(sections);
      const prev = nextSections.get(sectionId)!;
      const next = {
        ...prev,
        x: minX - padding,
        y: minY - padding,
        width: Math.max(0, maxX - minX + padding * 2),
        height: Math.max(0, maxY - minY + padding * 2),
      } as SectionElement;

      nextSections.set(sectionId, next);
      current.sections = nextSections;
    });
  },
});