/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Highlighter, 
  Underline as UnderlineIcon, 
  Bold as BoldIcon, 
  Eraser, 
  RotateCcw,
  MonitorPlay, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Search,
  Book,
  Loader2,
  ExternalLink,
  Settings,
  Italic,
  Sun,
  Moon,
  Type,
  Palette,
  Tv,
  Monitor,
  ScreenShare,
  ArrowRight,
  X,
  XCircle,
  Save,
  FolderOpen,
  Circle,
  Square,
  ChevronLeft,
  ChevronRight,
  Plus,
  Library,
  GripVertical,
  FileDown,
  Printer,
  Feather,
  Waves,
  GitCompareArrows,
  ListIndentIncrease,
  SeparatorHorizontal,
  Superscript,
  Eye,
  EyeOff
} from 'lucide-react';
import { useLayoutEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const getIsTauri = () => !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__ || window.location.protocol === 'tauri:';

interface Verse {
  id: string;
  reference: string;
  text: string;
  html?: string;
  bookHeader?: string;
  acrostic?: string;
  isNewPassage?: boolean;
  isNewChapter?: boolean;
}

interface AppSettings {
  textSize: number;
  textSpacing: number;
  scrollSpeed: number;
  verseCount: number;
  highlightIntensity: number;
  pageColor: string;
  theme: 'light' | 'dark';
  uiTheme: 'light' | 'dark';
  fontFamily: string;
  showVerseNumbers: boolean;
  oneVersePerLine: boolean;
  verseNumberColor: string;
  defaultTranslation: string;
  maxWidth: number;
  targetMonitor?: number;
  showReferenceBox: boolean;
  referenceBoxColor: string;
  showBookHeader?: boolean;
  bookHeaderSize?: number;
  showPoeticLabels?: boolean;
}

const DEFAULT_PASSAGE: Verse[] = [
  { id: 'Gen-1-1', reference: 'Genesis 1:1', text: "In the beginning, God created the heavens and the earth.", bookHeader: 'Genesis' },
  { id: 'Gen-1-2', reference: 'Genesis 1:2', text: "The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters." },
  { id: 'Gen-1-3', reference: 'Genesis 1:3', text: "And God said, \"Let there be light,\" and there was light." },
  { id: 'Gen-1-4', reference: 'Genesis 1:4', text: "And God saw that the light was good. And God separated the light from the darkness." },
  { id: 'Gen-1-5', reference: 'Genesis 1:5', text: "God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day." }
];

const TRANSLATIONS = [
  { id: 'esv', name: 'English Standard Version (ESV)' },
  { id: 'net', name: 'NET Bible (NET)' },
  { id: 'yv-niv', name: 'New International Version (NIV)' },
  { id: 'yv-nasb', name: 'New American Standard Bible (NASB)' },
  { id: 'kjv', name: 'King James Version (KJV)' },
  { id: 'web', name: 'World English Bible (WEB)' },
  { id: 'bbe', name: 'Bible in Basic English (BBE)' },
  { id: 'clementine', name: 'Clementine Latin Vulgate' },
  { id: 'wlc', name: 'Hebrew Old Testament (WLC)' },
  { id: 'lxx', name: 'Greek Septuagint (LXX)' },
  { id: 'sblgnt', name: 'SBL Greek New Testament (SBLGNT)' }
];

const FONT_OPTIONS = [
  { id: 'academic', name: 'Academic Serif (Crimson Pro)', css: 'var(--font-serif)' },
  { id: 'modern', name: 'Modern Sans (Inter)', css: 'var(--font-sans)' },
  { id: 'display', name: 'Bold Display (Outfit)', css: 'var(--font-display)' },
  { id: 'study', name: 'Study Monospace (JetBrains)', css: 'var(--font-mono)' },
  { id: 'playfair', name: 'Elegant Serif (Playfair)', css: 'var(--font-playfair)' },
  { id: 'cinzel', name: 'Classical Display (Cinzel)', css: 'var(--font-cinzel)' },
  { id: 'merriweather', name: 'Warm Serif (Merriweather)', css: 'var(--font-merriweather)' },
  { id: 'lora', name: 'Literary Serif (Lora)', css: 'var(--font-lora)' },
  { id: 'caveat', name: 'Handwritten Notes (Caveat)', css: 'var(--font-caveat)' },
  { id: 'montserrat', name: 'Geometric Sans (Montserrat)', css: 'var(--font-montserrat)' },
  { id: 'fira', name: 'Humanist Sans (Fira)', css: 'var(--font-fira)' },
  { id: 'garamond', name: 'Heritage Serif (Garamond)', css: 'var(--font-garamond)' },
  { id: 'courier', name: 'Typewriter Mono (Courier)', css: 'var(--font-courier)' },
  { id: 'bebas', name: 'Condensed Impact (Bebas Neue)', css: 'var(--font-bebas)' },
  { id: 'pacifico', name: 'Fun Script (Pacifico)', css: 'var(--font-pacifico)' }
];

const formatReference = (ref: string) => {
  if (!ref.toLowerCase().startsWith('psalm')) return ref;
  
  // Case 1: Single chapter range or single verse: "Psalms 1:1", "Psalms 1:1-5"
  // Case 2: Multi-chapter range: "Psalms 1-2", "Psalms 1:1 - 2:5"
  
  const isMultiChapter = ref.includes('-') && (
    // Check if there are two chapter numbers (e.g. "1-2" or "1:1-2:1")
    (ref.match(/\d+/g) || []).length > 2 || 
    // Or if it's just "Psalms 1-2" (no colons)
    (!ref.includes(':') && ref.includes('-'))
  );

  if (isMultiChapter) {
    return ref.replace(/^Psalm[s]?\b/i, 'Psalms');
  } else {
    return ref.replace(/^Psalm[s]?\b/i, 'Psalm');
  }
};

const BOOK_IDS: Record<string, number> = {
  'genesis': 1, 'gen': 1, 'gn': 1, 'exodus': 2, 'ex': 2, 'exod': 2, 'leviticus': 3, 'lev': 3, 'lv': 3, 'numbers': 4, 'num': 4, 'nm': 4, 'deuteronomy': 5, 'deut': 5, 'dt': 5,
  'joshua': 6, 'judges': 7, 'ruth': 8, '1 samuel': 9, '2 samuel': 10,
  '1 kings': 11, '2 kings': 12, '1 chronicles': 13, '2 chronicles': 14,
  'ezra': 15, 'nehemiah': 16, 'esther': 17, 'job': 18, 'psalms': 19, 'psalm': 19, 'ps': 19,
  'prov': 20, 'proverbs': 20, 'eccl': 21, 'ecc': 21, 'eccles': 21, 'ecclesiastes': 21, 'song of solomon': 22, 'song of songs': 22,
  'isaiah': 23, 'isa': 23, 'is': 23, 'jeremiah': 24, 'jer': 24, 'jr': 24, 'lamentations': 25, 'lam': 25, 'ezekiel': 26, 'ezek': 26, 'ez': 26, 'daniel': 27, 'dan': 27, 'dn': 27,
  'hosea': 28, 'joel': 29, 'amos': 30, 'obadiah': 31, 'jonah': 32, 'micah': 33,
  'nahum': 34, 'habakkuk': 35, 'zephaniah': 36, 'haggai': 37, 'zechariah': 38, 'malachi': 39,
  'matthew': 40, 'matt': 40, 'mat': 40, 'mt': 40, 'mark': 41, 'mrk': 41, 'mk': 41, 'luke': 42, 'luk': 42, 'lk': 42, 'john': 43, 'jhn': 43, 'jn': 43, 'acts': 44, 'act': 44, 'ac': 44, 'romans': 45, 'rom': 45, 'rm': 45,
  '1 corinthians': 46, '1cor': 46, '2 corinthians': 47, '2cor': 47, 'galatians': 48, 'gal': 48, 'ephesians': 49, 'eph': 49,
  'philippians': 50, 'phil': 50, 'colossians': 51, 'col': 51, '1 thessalonians': 52, '2 thessalonians': 53,
  '1 timothy': 54, '2 timothy': 55, 'titus': 56, 'philemon': 57, 'hebrews': 58, 'heb': 58,
  'james': 59, '1 peter': 60, '2 peter': 61, '1 john': 62, '2 john': 63, '3 john': 64,
  'jude': 65, 'jud': 65, 'revelation': 66, 'rev': 66, 'apoc': 66, 'apocalypse': 66
};

const CANONICAL_BOOKS: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon',
  23: 'Isaiah', 24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah', 33: 'Micah',
  34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai', 38: 'Zechariah', 39: 'Malachi',
  40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts', 45: 'Romans',
  46: '1 Corinthians', 47: '2 Corinthians', 48: 'Galatians', 49: 'Ephesians',
  50: 'Philippians', 51: 'Colossians', 52: '1 Thessalonians', 53: '2 Thessalonians',
  54: '1 Timothy', 55: '2 Timothy', 56: 'Titus', 57: 'Philemon', 58: 'Hebrews',
  59: 'James', 60: '1 Peter', 61: '2 Peter', 62: '1 John', 63: '2 John', 64: '3 John',
  65: 'Jude', 66: 'Revelation'
};

const USFM_BOOK_MAP: Record<string, string> = {
  'genesis': 'GEN', 'exodus': 'EXO', 'leviticus': 'LEV', 'numbers': 'NUM', 'deuteronomy': 'DEU',
  'joshua': 'JOS', 'judges': 'JDG', 'ruth': 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
  '1 kings': '1KI', '2 kings': '2KI', '1 chronicles': '1CH', '2 chronicles': '2CH',
  'ezra': 'EZR', 'nehemiah': 'NEH', 'esther': 'EST', 'job': 'JOB', 'psalms': 'PSA', 'psalm': 'PSA',
  'proverbs': 'PRO', 'ecclesiastes': 'ECC', 'song of solomon': 'SNG', 'song of songs': 'SNG',
  'isaiah': 'ISA', 'jeremiah': 'JER', 'lamentations': 'LAM', 'ezekiel': 'EZK', 'daniel': 'DAN',
  'hosea': 'HOS', 'joel': 'JOL', 'amos': 'AMO', 'obadiah': 'OBA', 'jonah': 'JON', 'micah': 'MIC',
  'nahum': 'NAM', 'habakkuk': 'HAB', 'zephaniah': 'ZEP', 'haggai': 'HAG', 'zechariah': 'ZEC', 'malachi': 'MAL',
  'matthew': 'MAT', 'mark': 'MRK', 'luke': 'LUK', 'john': 'JHN', 'acts': 'ACT', 'romans': 'ROM',
  '1 corinthians': '1CO', '2 corinthians': '2CO', 'galatians': 'GAL', 'ephesians': 'EPH',
  'philippians': 'PHP', 'colossians': 'COL', '1 thessalonians': '1TH', '2 thessalonians': '2TH',
  '1 timothy': '1TI', '2 timothy': '2TI', 'titus': 'TIT', 'philemon': 'PHM', 'hebrews': 'HEB',
  'james': 'JAS', '1 peter': '1PE', '2 peter': '2PE', '1 john': '1JN', '2 john': '2JN', '3 john': '3JN',
  'jude': 'JUD', 'revelation': 'REV'
};

function parseYouVersionHtml(html: string, bookName: string, chapter: string): { reference: string, text: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const versesList: { number: string, text: string }[] = [];
  
  let currentVerseNumber = "";
  let currentVerseText = "";
  
  function walk(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      
      const vAttr = el.getAttribute('v');
      const isYvVerse = el.classList.contains('yv-v') && vAttr;
      
      if (isYvVerse) {
        if (currentVerseNumber && currentVerseText.trim()) {
          versesList.push({ number: currentVerseNumber, text: currentVerseText.trim() });
        }
        currentVerseNumber = vAttr;
        currentVerseText = "";
        return;
      }
      
      if (el.classList.contains('yv-vlbl') || el.tagName === 'SUP') {
        return;
      }
      
      const usfm = el.getAttribute('data-usfm');
      const className = el.className || "";
      const isLabelOrV = className.split(' ').some(c => c === 'v' || c === 'verse-num' || c === 'label');
      
      if (usfm) {
        if (currentVerseNumber && currentVerseText.trim()) {
          versesList.push({ number: currentVerseNumber, text: currentVerseText.trim() });
        }
        const parts = usfm.split('.');
        currentVerseNumber = parts[parts.length - 1];
        currentVerseText = "";
        
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as HTMLElement;
            const childClass = childEl.className || "";
            if (childClass.split(' ').some(c => c === 'v' || c === 'verse-num' || c === 'label') || childEl.tagName === 'SUP') {
              continue;
            }
          }
          walk(child);
        }
        return;
      }
      
      if (isLabelOrV) {
        const text = el.textContent?.trim() || "";
        if (/^\d+$/.test(text)) {
          if (currentVerseNumber && currentVerseText.trim()) {
            versesList.push({ number: currentVerseNumber, text: currentVerseText.trim() });
          }
          currentVerseNumber = text;
          currentVerseText = "";
          return;
        }
      }
    }
    
    if (node.nodeType === Node.TEXT_NODE) {
      currentVerseText += node.textContent;
    }
    
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  }
  
  walk(doc.body);
  
  if (currentVerseNumber && currentVerseText.trim()) {
    versesList.push({ number: currentVerseNumber, text: currentVerseText.trim() });
  }
  
  if (versesList.length === 0) {
    const cleanText = doc.body.textContent || "";
    return [{
      reference: formatReference(`${bookName} ${chapter}`),
      text: cleanText.trim()
    }];
  }
  
  return versesList.map(v => ({
    reference: formatReference(`${bookName} ${chapter}:${v.number}`),
    text: v.text.replace(/\s+/g, ' ').trim()
  }));
}

const DEFAULT_SETTINGS: AppSettings = {
  textSize: 36,
  textSpacing: 1.7,
  scrollSpeed: 700,
  verseCount: 1,
  highlightIntensity: 0.5,
  pageColor: '#f0f0f4',
  theme: 'light',
  uiTheme: 'dark',
  fontFamily: 'academic',
  showVerseNumbers: true,
  oneVersePerLine: false,
  verseNumberColor: '#000000',
  defaultTranslation: 'esv',
  maxWidth: 1024,
  targetMonitor: 1,
  showReferenceBox: true,
  referenceBoxColor: '#1e293b',
  showBookHeader: true,
  bookHeaderSize: 64,
  showPoeticLabels: true
};

interface PoeticLink {
  id: string;
  type: 'inclusio' | 'chiasm' | 'parallel';
  label: string;
  color: string;
  fromAnchorId: string;
  toAnchorId: string;
}

interface VerseLayout {
  indent?: number;
  stanzaBreakBefore?: boolean;
}

const POETIC_CHIASM_STEPS = [
  { tag: 'A', color: '#0d9488' },
  { tag: 'B', color: '#3b82f6' },
  { tag: 'C', color: '#f59e0b' },
  { tag: "B'", color: '#3b82f6' },
  { tag: "A'", color: '#0d9488' }
];

const POETIC_PARALLEL_STEPS = [
  { tag: 'A', color: '#0d9488' },
  { tag: "A'", color: '#0d9488' },
  { tag: 'B', color: '#3b82f6' },
  { tag: "B'", color: '#3b82f6' },
  { tag: 'C', color: '#a855f7' },
  { tag: "C'", color: '#a855f7' }
];

const POETIC_LINK_META: Record<'inclusio' | 'parallel' | 'chiasm', { label: string; color: string; hint: string }> = {
  inclusio: { label: 'Inclusio', color: '#10b981', hint: 'Frames opening & closing echo' },
  parallel: { label: 'Parallel', color: '#6366f1', hint: 'Connects mirrored lines' },
  chiasm: { label: 'Chiasm', color: '#f43f5e', hint: 'Connects inverted pair' }
};

const POETIC_LABEL_PRESETS = ['inclusio', 'parallel', 'chiasm', 'echo', 'contrast'] as const;
type PoeticLabelPreset = typeof POETIC_LABEL_PRESETS[number];

interface ComputedPoeticArc {
  link: PoeticLink;
  topY: number;
  botY: number;
  edgeX: number;
  railX: number;
  active: boolean;
}

const PoeticGutterOverlay: React.FC<{
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  poeticLinks: PoeticLink[];
  activeVerseIndex: number;
  verseCount: number;
  isRtl: boolean;
  isControl: boolean;
  onRemoveLink?: (linkId: string) => void;
  depsKey: string;
}> = ({ wrapperRef, poeticLinks, activeVerseIndex, verseCount, isRtl, isControl, onRemoveLink, depsKey }) => {
  const [arcs, setArcs] = useState<ComputedPoeticArc[]>([]);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !poeticLinks || poeticLinks.length === 0) {
      setArcs([]);
      return;
    }

    const computeArcs = () => {
      const wRect = wrapper.getBoundingClientRect();
      if (wRect.width === 0) return;

      const rawItems: { link: PoeticLink; topY: number; botY: number; active: boolean }[] = [];
      for (const link of poeticLinks) {
        const fromEl = wrapper.querySelector(`[data-glide-anchor="${link.fromAnchorId}"]`) as HTMLElement | null;
        const toEl = wrapper.querySelector(`[data-glide-anchor="${link.toAnchorId}"]`) as HTMLElement | null;
        if (!fromEl || !toEl) continue;

        const r1 = fromEl.getBoundingClientRect();
        const r2 = toEl.getBoundingClientRect();
        const y1 = r1.top - wRect.top + r1.height / 2;
        const y2 = r2.top - wRect.top + r2.height / 2;
        const topY = Math.min(y1, y2);
        const botY = Math.max(y1, y2);

        const v1El = fromEl.closest('[data-verse-index]');
        const v2El = toEl.closest('[data-verse-index]');
        const v1Idx = v1El ? parseInt(v1El.getAttribute('data-verse-index') || '-1', 10) : -1;
        const v2Idx = v2El ? parseInt(v2El.getAttribute('data-verse-index') || '-1', 10) : -1;
        const endActive = activeVerseIndex + verseCount;
        const isEndpointActive =
          (v1Idx >= activeVerseIndex && v1Idx < endActive) ||
          (v2Idx >= activeVerseIndex && v2Idx < endActive);

        rawItems.push({ link, topY, botY, active: isEndpointActive });
      }

      rawItems.sort((a, b) => (a.botY - a.topY) - (b.botY - b.topY));
      const lanes: { topY: number; botY: number }[][] = [];
      const computed: ComputedPoeticArc[] = [];

      for (const item of rawItems) {
        let laneIdx = 0;
        while (true) {
          const existing = lanes[laneIdx] || [];
          const overlaps = existing.some(e => !(item.botY + 8 < e.topY || item.topY - 8 > e.botY));
          if (!overlaps) {
            existing.push({ topY: item.topY, botY: item.botY });
            lanes[laneIdx] = existing;
            break;
          }
          laneIdx++;
        }

        const edgeX = isRtl ? wRect.width - 8 : 8;
        const offset = 18 + laneIdx * 22;
        const railX = isRtl ? wRect.width + offset : -offset;
        computed.push({
          link: item.link,
          topY: item.topY,
          botY: item.botY,
          edgeX,
          railX,
          active: item.active
        });
      }

      setArcs(computed);
    };

    computeArcs();

    const ro = new ResizeObserver(() => computeArcs());
    ro.observe(wrapper);

    const mo = new MutationObserver(() => requestAnimationFrame(computeArcs));
    mo.observe(wrapper, { childList: true, subtree: true, characterData: true });

    window.addEventListener('resize', computeArcs);
    const raf = requestAnimationFrame(computeArcs);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', computeArcs);
    };
  }, [wrapperRef, poeticLinks, activeVerseIndex, verseCount, isRtl, depsKey]);

  if (arcs.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-20 select-none"
      aria-hidden="true"
    >
      {arcs.map(({ link, topY, botY, edgeX, railX, active }) => {
        const dir = isRtl ? 1 : -1;
        const r = Math.min(10, Math.abs(botY - topY) / 2);
        const midY = (topY + botY) / 2;
        const d =
          botY - topY < 4
            ? `M ${edgeX} ${topY} L ${railX} ${topY}`
            : `M ${edgeX} ${topY} L ${railX - dir * r} ${topY} Q ${railX} ${topY} ${railX} ${topY + r} L ${railX} ${botY - r} Q ${railX} ${botY} ${railX - dir * r} ${botY} L ${edgeX} ${botY}`;
        const opacity = active ? 0.92 : 0.45;
        const labelX = railX;

        return (
          <g key={link.id} style={{ opacity, transition: 'opacity 300ms ease' }}>
            <path
              d={d}
              fill="none"
              stroke={link.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={link.type === 'parallel' ? '6 4' : undefined}
            />
            <circle cx={edgeX} cy={topY} r={3.5} fill={link.color} />
            <circle cx={edgeX} cy={botY} r={3.5} fill={link.color} />
            <g
              transform={`translate(${labelX}, ${midY})`}
              className={isControl && onRemoveLink ? 'pointer-events-auto cursor-pointer' : ''}
              onClick={(e) => {
                if (!isControl || !onRemoveLink) return;
                e.stopPropagation();
                onRemoveLink(link.id);
              }}
            >
              {isControl && <title>{`${link.label} — Click to remove link`}</title>}
              <rect
                x={-26}
                y={-9}
                width={52}
                height={18}
                rx={9}
                fill={link.color}
              />
              <text
                x={0}
                y={3.5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="9"
                fontWeight="800"
                fontFamily="Inter, sans-serif"
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {link.label.slice(0, 8)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

interface ScriptureSession {
  id: string;
  name: string;
  verses: Verse[];
  translation: string;
  activeVerseIndex: number;
  referenceInput: string;
  filePath?: string;
  poeticLinks?: PoeticLink[];
  verseLayout?: Record<string, VerseLayout>;
}

export default function App() {
  const [appMode, setAppMode] = useState<'select' | 'control' | 'present'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'presentation' ? 'present' : 'select';
    } catch {
      return 'select';
    }
  });
  const [displayMode, setDisplayMode] = useState<'single' | 'dual'>(() => {
    try { return (localStorage.getItem('osb_display_mode') as 'single' | 'dual') || 'single'; } catch { return 'single'; }
  });
  const [isTauriApp, setIsTauriApp] = useState(getIsTauri());
  const [syncChannel] = useState(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        return new BroadcastChannel('verse_sync_channel');
      }
    } catch (e) {}
    return { postMessage: () => {}, onmessage: null } as unknown as BroadcastChannel;
  });

  const [sessions, setSessions] = useState<ScriptureSession[]>(() => {
    try {
      const saved = localStorage.getItem('osb_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [{
      id: 'default',
      name: 'Genesis 1:1-5 (ESV)',
      verses: DEFAULT_PASSAGE,
      translation: 'esv',
      activeVerseIndex: 0,
      referenceInput: 'Genesis 1:1-5'
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('osb_active_session_id');
      if (saved && saved !== 'null') return saved;
    } catch (e) {}
    return 'default';
  });

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('osb_sidebar_open') !== 'false';
    } catch {
      return true;
    }
  });

  const [currentSetFilePath, setCurrentSetFilePath] = useState<string | null>(() => {
    try {
      return localStorage.getItem('osb_set_file_path') || null;
    } catch {
      return null;
    }
  });

  const [currentSetName, setCurrentSetName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('osb_set_name') || null;
    } catch {
      return null;
    }
  });

  const [hasUnsavedSetChanges, setHasUnsavedSetChanges] = useState<boolean>(() => {
    try {
      return localStorage.getItem('osb_set_dirty') === 'true';
    } catch {
      return false;
    }
  });

  const [showLibrarySetMenu, setShowLibrarySetMenu] = useState(false);
  const [showUnsavedSetModal, setShowUnsavedSetModal] = useState(false);
  const [isDraggingGlideFile, setIsDraggingGlideFile] = useState(false);
  const [pendingExternalGlideFile, setPendingExternalGlideFile] = useState<{ filePath: string | null; filename: string; data: any } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [exportPaperStyle, setExportPaperStyle] = useState<'white' | 'screen'>('white');
  const [exportShowVerseNumbers, setExportShowVerseNumbers] = useState(true);
  const [exportOneVersePerLine, setExportOneVersePerLine] = useState(false);
  const [exportPrintSnapshot, setExportPrintSnapshot] = useState<{
    sessions: ScriptureSession[];
    title: string;
    subtitle: string;
    paperStyle: 'white' | 'screen';
    showVerseNumbers: boolean;
    oneVersePerLine: boolean;
  } | null>(null);
  const librarySetMenuRef = useRef<HTMLDivElement>(null);
  const browserSetInputRef = useRef<HTMLInputElement>(null);
  const pendingBrowserLoadModeRef = useRef<'replace' | 'append'>('replace');
  const appModeRef = useRef(appMode);
  const hasUnsavedSetChangesRef = useRef(hasUnsavedSetChanges);
  const currentSetFilePathRef = useRef(currentSetFilePath);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    hasUnsavedSetChangesRef.current = hasUnsavedSetChanges;
  }, [hasUnsavedSetChanges]);

  useEffect(() => {
    currentSetFilePathRef.current = currentSetFilePath;
  }, [currentSetFilePath]);

  useEffect(() => {
    try {
      localStorage.setItem('osb_sessions', JSON.stringify(sessions));
    } catch (e) {}
  }, [sessions]);

  useEffect(() => {
    try {
      if (currentSetFilePath) localStorage.setItem('osb_set_file_path', currentSetFilePath);
      else localStorage.removeItem('osb_set_file_path');
    } catch (e) {}
  }, [currentSetFilePath]);

  useEffect(() => {
    try {
      if (currentSetName) localStorage.setItem('osb_set_name', currentSetName);
      else localStorage.removeItem('osb_set_name');
    } catch (e) {}
  }, [currentSetName]);

  useEffect(() => {
    try {
      localStorage.setItem('osb_set_dirty', hasUnsavedSetChanges ? 'true' : 'false');
    } catch (e) {}
  }, [hasUnsavedSetChanges]);

  useEffect(() => {
    if (!showLibrarySetMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (librarySetMenuRef.current && !librarySetMenuRef.current.contains(e.target as Node)) {
        setShowLibrarySetMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLibrarySetMenu(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showLibrarySetMenu]);

  useEffect(() => {
    try {
      localStorage.setItem('osb_active_session_id', activeSessionId);
    } catch (e) {}
  }, [activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('osb_sidebar_open', sidebarOpen.toString());
    } catch (e) {}
  }, [sidebarOpen]);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0] || {
      id: 'default',
      name: 'Genesis 1:1-5 (ESV)',
      verses: DEFAULT_PASSAGE,
      translation: 'esv',
      activeVerseIndex: 0,
      referenceInput: 'Genesis 1:1-5'
    };
  }, [sessions, activeSessionId]);

  const verses = activeSession.verses;
  const activeVerseIndex = activeSession.activeVerseIndex;
  const translation = activeSession.translation;
  const referenceInput = activeSession.referenceInput;
  const poeticLinks = useMemo(() => activeSession.poeticLinks || [], [activeSession.poeticLinks]);
  const verseLayout = useMemo(() => activeSession.verseLayout || {}, [activeSession.verseLayout]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const setVerses = useCallback((newVerses: Verse[] | ((prev: Verse[]) => Verse[])) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolvedVerses = typeof newVerses === 'function' ? newVerses(s.verses) : newVerses;
        const updated = { ...s, verses: resolvedVerses };
        if (resolvedVerses.length > 0) {
          const isCustom = resolvedVerses[0].reference.startsWith('Segment');
          if (isCustom) {
            updated.name = updated.name.startsWith('Custom Text') ? updated.name : `Custom Text (${resolvedVerses.length} lines)`;
          } else {
            const firstRef = resolvedVerses[0].reference;
            const lastRef = resolvedVerses[resolvedVerses.length - 1].reference;
            const cleanFirst = firstRef.replace(/\./g, '');
            const cleanLast = lastRef.replace(/\./g, '');
            const firstParts = cleanFirst.split(' ');
            const lastParts = cleanLast.split(' ');
            let combinedRef = cleanFirst;
            if (cleanFirst !== cleanLast) {
              if (firstParts[0] === lastParts[0] && cleanFirst.includes(':') && cleanLast.includes(':')) {
                const firstChapV = firstParts[firstParts.length - 1];
                const lastChapV = lastParts[lastParts.length - 1];
                const firstV = firstChapV.split(':')[1];
                const lastV = lastChapV.split(':')[1];
                const chap = firstChapV.split(':')[0];
                if (firstChapV.split(':')[0] === lastChapV.split(':')[0]) {
                  combinedRef = `${firstParts.slice(0, -1).join(' ')} ${chap}:${firstV}-${lastV}`;
                } else {
                  combinedRef = `${cleanFirst} - ${lastChapV}`;
                }
              } else {
                combinedRef = `${cleanFirst} - ${cleanLast}`;
              }
            }
            updated.name = `${combinedRef} (${updated.translation.toUpperCase()})`;
          }
        } else {
          updated.name = 'Empty Session';
        }
        return updated;
      }
      return s;
    }));
  }, []);

  const setActiveVerseIndex = useCallback((newIndex: number | ((prev: number) => number)) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolvedIndex = typeof newIndex === 'function' ? newIndex(s.activeVerseIndex) : newIndex;
        return { ...s, activeVerseIndex: resolvedIndex };
      }
      return s;
    }));
  }, []);

  const setPoeticLinks = useCallback((newLinks: PoeticLink[] | ((prev: PoeticLink[]) => PoeticLink[])) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolved = typeof newLinks === 'function' ? newLinks(s.poeticLinks || []) : newLinks;
        return { ...s, poeticLinks: resolved };
      }
      return s;
    }));
  }, []);

  const setVerseLayout = useCallback((newLayout: Record<string, VerseLayout> | ((prev: Record<string, VerseLayout>) => Record<string, VerseLayout>)) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolved = typeof newLayout === 'function' ? newLayout(s.verseLayout || {}) : newLayout;
        return { ...s, verseLayout: resolved };
      }
      return s;
    }));
  }, []);

  const setTranslation = useCallback((newTrans: string | ((prev: string) => string)) => {
    setHasUnsavedSetChanges(true);
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolvedTrans = typeof newTrans === 'function' ? newTrans(s.translation) : newTrans;
        const updated = { ...s, translation: resolvedTrans };
        if (updated.verses.length > 0 && !updated.verses[0].reference.startsWith('Segment')) {
          const parts = updated.name.lastIndexOf(' (');
          if (parts !== -1) {
            updated.name = updated.name.substring(0, parts) + ` (${resolvedTrans.toUpperCase()})`;
          }
        }
        return updated;
      }
      return s;
    }));
  }, []);

  const setReferenceInput = useCallback((newInput: string | ((prev: string) => string)) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionIdRef.current) {
        const resolvedInput = typeof newInput === 'function' ? newInput(s.referenceInput) : newInput;
        return { ...s, referenceInput: resolvedInput };
      }
      return s;
    }));
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionIdRef.current) return;
    setSessions(prev => {
      let domDirty = false;
      const flushed = prev.map(s => {
        if (s.id !== activeSessionIdRef.current) return s;
        const updatedVerses = s.verses.map((v, i) => {
          const el = document.getElementById(`verse-${i}`);
          if (!el) return v;
          const html = el.innerHTML.replace(/\u200E/g, '');
          if (v.html === html) return v;
          domDirty = true;
          return { ...v, html };
        });
        return domDirty ? { ...s, verses: updatedVerses } : s;
      });
      if (domDirty) setHasUnsavedSetChanges(true);

      const targetSession = flushed.find(s => s.id === sessionId);
      if (targetSession) {
        setTimeout(() => {
          setPendingPoeticAnchor(null);
          const stateToSave = { 
            verses: targetSession.verses, 
            activeIndex: targetSession.activeVerseIndex, 
            settings: stateRef.current.settings,
            translation: targetSession.translation,
            poeticLinks: targetSession.poeticLinks || [],
            verseLayout: targetSession.verseLayout || {}
          };
          try {
            syncChannel.postMessage(stateToSave);
          } catch (e) {}
          if (isTauriApp) {
            invoke('set_state', { state: stateToSave }).catch(() => {});
          }
        }, 50);
      }
      return domDirty ? flushed : prev;
    });
    setActiveSessionId(sessionId);
  }, [syncChannel, isTauriApp]);

  const [readingMode, setReadingMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('osb_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.settings) return { ...DEFAULT_SETTINGS, ...parsed.settings };
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });
  const [showCustomTextModal, setShowCustomTextModal] = useState(false);
  const [customTextValue, setCustomTextValue] = useState("");

  const uiTheme = settings.uiTheme || 'dark';
  const uiBg = uiTheme === 'dark' ? 'bg-slate-900' : 'bg-white';
  const uiBorder = uiTheme === 'dark' ? 'border-slate-700' : 'border-slate-200';
  const uiText = uiTheme === 'dark' ? 'text-white' : 'text-slate-900';
  const uiTextMuted = uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const uiBtnBg = uiTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-100';
  const uiBtnHover = uiTheme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-200';
  const uiShadow = uiTheme === 'dark' ? 'shadow-black/50' : 'shadow-slate-200';
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [esvApiKey, setEsvApiKey] = useState(() => {
    const defaultKey = (import.meta as any).env?.VITE_ESV_API_KEY || "529ce3f16ed2a1f62d376cd4162d4765ea3dbba4";
    try { return localStorage.getItem('esvApiKey') || defaultKey; } catch { return defaultKey; }
  });
  
  const [activeTool, setActiveTool] = useState<{ type: string, value: string | null } | null>(null);
  const [activeMarkupColor, setActiveMarkupColor] = useState('#fbbf24');
  const [toolbarMode, setToolbarMode] = useState<'study' | 'poetic'>('study');
  const [poeticSequenceMode, setPoeticSequenceMode] = useState<'chiasm' | 'parallel'>('chiasm');
  const [poeticStepIndex, setPoeticStepIndex] = useState(0);
  const [poeticLinkType, setPoeticLinkType] = useState<'inclusio' | 'parallel' | 'chiasm'>('inclusio');
  const [pendingPoeticAnchor, setPendingPoeticAnchor] = useState<{
    anchorId: string;
    verseIndex: number;
    type: 'inclusio' | 'parallel' | 'chiasm';
    color: string;
  } | null>(null);
  const [poeticLabelPreset, setPoeticLabelPreset] = useState<PoeticLabelPreset>('inclusio');
  const [resetKey, setResetKey] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [availableMonitors, setAvailableMonitors] = useState<any[]>([]);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlWrapperRef = useRef<HTMLDivElement>(null);
  const presentWrapperRef = useRef<HTMLDivElement>(null);

  const linkedPartnerVerseIndices = useMemo(() => {
    const partners = new Set<number>();
    if (!poeticLinks.length || !verses.length) return partners;
    const anchorVerseMap = new Map<string, number>();
    verses.forEach((v, idx) => {
      const html = v.html || '';
      if (!html.includes('data-glide-anchor=')) return;
      const matches = html.matchAll(/data-glide-anchor="([^"]+)"/g);
      for (const m of matches) {
        anchorVerseMap.set(m[1], idx);
      }
    });
    const activeEnd = activeVerseIndex + settings.verseCount;
    poeticLinks.forEach(link => {
      const fromIdx = anchorVerseMap.get(link.fromAnchorId);
      const toIdx = anchorVerseMap.get(link.toAnchorId);
      if (fromIdx === undefined || toIdx === undefined) return;
      const fromActive = fromIdx >= activeVerseIndex && fromIdx < activeEnd;
      const toActive = toIdx >= activeVerseIndex && toIdx < activeEnd;
      if (fromActive && !toActive) partners.add(toIdx);
      if (toActive && !fromActive) partners.add(fromIdx);
    });
    return partners;
  }, [poeticLinks, verses, activeVerseIndex, settings.verseCount]);

  const presentationWinRef = useRef<Window | null>(null);

  useEffect(() => {
    const initTauri = async () => {
      console.log('Starting Tauri Bridge initialization...');
      for (let i = 0; i < 20; i++) {
        try {
          const m = (await invoke('list_monitors')) as any[];
          console.log('Bridge found via try-call! Fetching hardware info...');
          setIsTauriApp(true);
          setAvailableMonitors(m);
          if (Array.isArray(m) && m.length > 0) {
            let hasSavedMonitor = false;
            try {
              const savedState = localStorage.getItem('osb_state');
              const parsed = savedState ? JSON.parse(savedState) : null;
              hasSavedMonitor = typeof parsed?.settings?.targetMonitor === 'number' && parsed.settings.targetMonitor < m.length;
            } catch {}
            if (!hasSavedMonitor) {
              const externalMonitor = m.find(mon => !mon.isPrimary) || m[0];
              if (externalMonitor) {
                setSettings(prev => ({ ...prev, targetMonitor: externalMonitor.index }));
              }
            }
          }
          checkForUpdates(false);
          setBridgeError(null);

          return;
        } catch (e: any) {
          // If the error is "invoke is not a function", the bridge isn't injected yet
          // If it's a permission error, the bridge IS there but we're blocked
          if (typeof invoke === 'function') {
            console.log('Bridge detected but call failed (waiting for injection):', e);
            if (e.toString().includes('permission') || e.toString().includes('not allowed')) {
              setIsTauriApp(true);
              setBridgeError('Access Denied: Check Tauri permissions.');
              return;
            }
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
      setBridgeError('Bridge Timeout: System hardware unreachable.');
    };
    initTauri();
  }, []);

  const checkForUpdates = async (manual: boolean) => {
    try {
      // Direct imports from @tauri-apps/api/plugin-updater etc might be better
      const { check } = await import('@tauri-apps/plugin-updater');
      const { ask, message } = await import('@tauri-apps/plugin-dialog');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const { getVersion } = await import('@tauri-apps/api/app');

      const currentVersion = await getVersion();
      const update = await check();
      if (update) {
        const yes = await ask(
          `There is a newer version. Would you like to update to version ${update.version}?`,
          { title: 'Update Available', kind: 'info', okLabel: 'Update Now', cancelLabel: 'Later' }
        );
        if (yes) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } else if (manual) {
        await message(`Up to date. Version ${currentVersion} is the current version.`, { title: 'No Update Found', kind: 'info' });
      }
    } catch (e) {
      console.error('Update check failed:', e);
      if (manual) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        const { getVersion } = await import('@tauri-apps/api/app');
        try {
          const currentVersion = await getVersion();
          await message(`Up to date. Version ${currentVersion} is the current version.`, { title: 'Update Check', kind: 'info' });
        } catch {
          await message('No updates found or repository is private.', { title: 'Update Check', kind: 'info' });
        }
      }
    }
  };

  const togglePresentation = async () => {
    console.log('togglePresentation triggered. isPresenting:', isPresenting, 'isTauriApp:', isTauriApp);
    try {
      if (isTauriApp) {
        if (isPresenting) {
          console.log('Closing Tauri presentation window...');
          await invoke('close_presentation_window');
          setIsPresenting(false);
        } else {
          console.log('Opening Tauri presentation window on monitor:', settings.targetMonitor);
          await invoke('open_presentation_window', { monitorIndex: settings.targetMonitor });
          setIsPresenting(true);
        }
      } else {
        if (presentationWinRef.current && !presentationWinRef.current.closed) {
          console.log('Closing browser presentation window...');
          presentationWinRef.current.close();
          setIsPresenting(false);
        } else {
          console.log('Opening browser presentation window...');
          const url = new URL(window.location.origin);
          url.searchParams.set('view', 'presentation');
          presentationWinRef.current = window.open(url.toString(), 'ScripturePresentation', 'width=1024,height=768');
          setIsPresenting(true);
        }
      }
    } catch (err) {
      console.error('Failed to toggle presentation:', err);
      // Fallback: try to close anyway if we think we're presenting
      if (isPresenting) setIsPresenting(false);
    }
    setTimeout(() => syncStateToStorage(), 500);
  };

  useEffect(() => {
    let unlisten: UnlistenFn;
    if (isTauriApp) {
      listen('presentation-closed', () => {
        setIsPresenting(false);
      }).then(fn => { unlisten = fn; });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [isTauriApp]);

  useEffect(() => {
    try { localStorage.setItem('esvApiKey', esvApiKey); } catch {}
  }, [esvApiKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'presentation') {
      setAppMode('present');
    }
  }, []);

  useEffect(() => {
    if (appMode !== 'control') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const i = Math.max(activeVerseIndex - settings.verseCount, 0);
        setActiveVerseIndex(i);
        syncStateToStorage({ index: i });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const i = Math.min(activeVerseIndex + settings.verseCount, verses.length - 1);
        setActiveVerseIndex(i);
        syncStateToStorage({ index: i });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, activeVerseIndex, settings, verses, verses.length]);

  useEffect(() => {
    if (appMode === 'present') {
      try {
        const savedState = localStorage.getItem('osb_state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setVerses(parsed.verses || DEFAULT_PASSAGE);
          setActiveVerseIndex(parsed.activeIndex || 0);
          if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
          if (Array.isArray(parsed.poeticLinks)) setPoeticLinks(parsed.poeticLinks);
          if (parsed.verseLayout && typeof parsed.verseLayout === 'object') setVerseLayout(parsed.verseLayout);
        }
      } catch (e) {}
    }
  }, [appMode]);


  const saveStudy = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      let filePath = activeSession.filePath;
      if (!filePath) {
        filePath = await save({
          filters: [{
            name: 'ScriptureGlide Markup',
            extensions: ['glide']
          }]
        }) || undefined;
      }

      if (filePath) {
        const data = {
          verses,
          settings,
          translation,
          poeticLinks,
          verseLayout,
          version: '1.0'
        };
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        const filename = filePath.split(/[/\\]/).pop() || 'Saved Study';
        
        // Update session info
        const targetPath = filePath;
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return { ...s, filePath: targetPath, name: filename };
          }
          return s;
        }));
      }
    } catch (err: any) {
      console.error('Failed to save markup:', err);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(`Failed to save: ${err.message || err}`, { title: 'Save Error', kind: 'error' });
    }
  };

  const saveStudyAs = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const filePath = await save({
        filters: [{
          name: 'ScriptureGlide Markup',
          extensions: ['glide']
        }]
      });

      if (filePath) {
        const data = {
          verses,
          settings,
          translation,
          poeticLinks,
          verseLayout,
          version: '1.0'
        };
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        const filename = filePath.split(/[/\\]/).pop() || 'Saved Study';
        
        const targetPath = filePath;
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return { ...s, filePath: targetPath, name: filename };
          }
          return s;
        }));
      }
    } catch (err: any) {
      console.error('Failed to save markup:', err);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(`Failed to save: ${err.message || err}`, { title: 'Save Error', kind: 'error' });
    }
  };

  const loadStudy = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ScriptureGlide Markup',
          extensions: ['glide']
        }]
      });

      if (selected && !Array.isArray(selected)) {
        const content = await readTextFile(selected);
        const data = JSON.parse(content);
        const filename = selected.split(/[/\\]/).pop() || 'Loaded Study';
        applyLoadedSetData(data, selected, filename, 'append');
      }
    } catch (err: any) {
      console.error('Failed to load markup:', err);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(`Failed to load: ${err.message || err}`, { title: 'Load Error', kind: 'error' });
    }
  };

  const getLatestSessionsSnapshot = useCallback((): ScriptureSession[] => {
    return sessionsRef.current.map(s => {
      if (s.id !== activeSessionIdRef.current) return s;
      const updatedVerses = s.verses.map((v, i) => {
        const el = document.getElementById(`verse-${i}`);
        if (!el) return v;
        const html = el.innerHTML.replace(/\u200E/g, '');
        return v.html === html ? v : { ...v, html };
      });
      return { ...s, verses: updatedVerses };
    });
  }, []);

  const saveSet = async (forceSaveAs = false): Promise<boolean> => {
    try {
      const latestSessions = getLatestSessionsSnapshot();
      const hasDomUpdates = latestSessions.some((s, idx) => s !== sessionsRef.current[idx]);
      if (hasDomUpdates) {
        setSessions(latestSessions);
      }

      const buildPayload = (setNameLabel: string) => ({
        type: 'scriptureglide-set',
        version: '2.0',
        setName: setNameLabel,
        sessions: latestSessions,
        activeSessionId: activeSessionIdRef.current,
        settings
      });

      if (!isTauriApp) {
        const baseName = (currentSetName || 'ScriptureGlide-Set').replace(/\.glide$/i, '');
        const blob = new Blob([JSON.stringify(buildPayload(baseName), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.glide`;
        a.click();
        URL.revokeObjectURL(url);
        setCurrentSetName(baseName);
        setHasUnsavedSetChanges(false);
        return true;
      }

      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      let filePath = !forceSaveAs ? currentSetFilePath : null;
      if (!filePath) {
        filePath = await save({
          defaultPath: currentSetFilePath || `${(currentSetName || 'ScriptureGlide Set').replace(/\.glide$/i, '')}.glide`,
          filters: [{
            name: 'ScriptureGlide Set',
            extensions: ['glide']
          }]
        }) || null;
      }

      if (!filePath) return false;

      const filename = filePath.split(/[/\\]/).pop() || 'ScriptureGlide Set';
      const cleanName = filename.replace(/\.glide$/i, '');
      await writeTextFile(filePath, JSON.stringify(buildPayload(cleanName), null, 2));

      setCurrentSetFilePath(filePath);
      setCurrentSetName(cleanName);
      setHasUnsavedSetChanges(false);
      return true;
    } catch (err: any) {
      console.error('Failed to save set:', err);
      if (isTauriApp) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`Failed to save set: ${err.message || err}`, { title: 'Save Error', kind: 'error' });
      } else {
        alert(`Failed to save set: ${err.message || err}`);
      }
      return false;
    }
  };

  const applyLoadedSetData = (data: any, filePath: string | null, filename: string, mode: 'replace' | 'append') => {
    const normalizeSession = (raw: any, index: number, forceNewId: boolean): ScriptureSession => {
      const versesArr: Verse[] = Array.isArray(raw?.verses) ? raw.verses : [];
      const firstRef = versesArr[0]?.reference || 'Genesis 1:1';
      const fallbackRefInput = firstRef.includes(':') ? firstRef.split(':')[0] : firstRef;
      return {
        id: forceNewId || !raw?.id ? `session-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}` : String(raw.id),
        name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : `Passage ${index + 1}`,
        verses: versesArr,
        translation: typeof raw?.translation === 'string' && raw.translation ? raw.translation : 'esv',
        activeVerseIndex: typeof raw?.activeVerseIndex === 'number' ? raw.activeVerseIndex : 0,
        referenceInput: typeof raw?.referenceInput === 'string' && raw.referenceInput ? raw.referenceInput : fallbackRefInput,
        filePath: typeof raw?.filePath === 'string' ? raw.filePath : undefined,
        poeticLinks: Array.isArray(raw?.poeticLinks) ? raw.poeticLinks : undefined,
        verseLayout: raw?.verseLayout && typeof raw.verseLayout === 'object' ? raw.verseLayout : undefined
      };
    };

    let importedSessions: ScriptureSession[] = [];
    const isSetPayload = Array.isArray(data?.sessions);

    if (isSetPayload) {
      const seenIds = new Set<string>();
      importedSessions = data.sessions.map((raw: any, idx: number) => {
        const needsNewId = mode === 'append' || !raw?.id || seenIds.has(String(raw.id));
        const normalized = normalizeSession(raw, idx, needsNewId);
        seenIds.add(normalized.id);
        return normalized;
      });
    } else if (Array.isArray(data?.verses)) {
      importedSessions = [
        normalizeSession({
          name: filename.replace(/\.glide$/i, ''),
          verses: data.verses,
          translation: data.translation || 'esv',
          activeVerseIndex: 0,
          filePath: filePath || undefined,
          poeticLinks: Array.isArray(data.poeticLinks) ? data.poeticLinks : undefined,
          verseLayout: data.verseLayout && typeof data.verseLayout === 'object' ? data.verseLayout : undefined
        }, 0, true)
      ];
    } else {
      throw new Error('Unrecognized ScriptureGlide file format.');
    }

    if (importedSessions.length === 0) {
      throw new Error('The selected file does not contain any passages.');
    }

    let targetSession = importedSessions[0];

    if (mode === 'replace') {
      if (isSetPayload && data.activeSessionId) {
        const matched = importedSessions.find(s => s.id === data.activeSessionId);
        if (matched) targetSession = matched;
      }
      setSessions(importedSessions);
      setActiveSessionId(targetSession.id);
      setResetKey(prev => prev + 1);
      setCurrentSetFilePath(isSetPayload ? filePath : null);
      setCurrentSetName(filename.replace(/\.glide$/i, ''));
      setHasUnsavedSetChanges(false);
    } else {
      setSessions(prev => [...prev, ...importedSessions]);
      setActiveSessionId(targetSession.id);
      setResetKey(prev => prev + 1);
      setHasUnsavedSetChanges(true);
    }

    setPendingPoeticAnchor(null);
    setTimeout(() => syncStateToStorage({
      verses: targetSession.verses,
      index: targetSession.activeVerseIndex,
      poeticLinks: targetSession.poeticLinks || [],
      verseLayout: targetSession.verseLayout || {},
      forceDomRead: false
    }), 100);
  };

  const performLoadSet = async (mode: 'replace' | 'append') => {
    try {
      if (!isTauriApp) {
        pendingBrowserLoadModeRef.current = mode;
        browserSetInputRef.current?.click();
        return;
      }

      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ScriptureGlide Set / Markup',
          extensions: ['glide', 'json']
        }]
      });

      if (selected && !Array.isArray(selected)) {
        const content = await readTextFile(selected);
        const data = JSON.parse(content);
        const filename = selected.split(/[/\\]/).pop() || 'Loaded Set';
        applyLoadedSetData(data, selected, filename, mode);
      }
    } catch (err: any) {
      console.error('Failed to load set:', err);
      if (isTauriApp) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`Failed to load set: ${err.message || err}`, { title: 'Load Error', kind: 'error' });
      } else {
        alert(`Failed to load set: ${err.message || err}`);
      }
    }
  };

  const handleBrowserSetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      applyLoadedSetData(data, null, file.name, pendingBrowserLoadModeRef.current);
    } catch (err: any) {
      console.error('Failed to load set file:', err);
      alert(`Failed to load set: ${err.message || err}`);
    }
  };

  const requestLoadSet = (mode: 'replace' | 'append') => {
    setShowLibrarySetMenu(false);
    if (mode === 'replace' && hasUnsavedSetChanges) {
      setShowUnsavedSetModal(true);
      return;
    }
    performLoadSet(mode);
  };

  const isSupportedGlideFilename = (name: string) => /\.(glide|json)$/i.test(name.trim());

  const showLoadErrorMessage = useCallback(async (title: string, detail: string) => {
    if (isTauriApp) {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(detail, { title, kind: 'error' });
    } else {
      alert(detail);
    }
  }, [isTauriApp]);

  const openExternalGlidePayload = useCallback((data: any, filePath: string | null, filename: string) => {
    const isSetPayload = Array.isArray(data?.sessions);
    const isSinglePayload = Array.isArray(data?.verses);
    if (!isSetPayload && !isSinglePayload) {
      throw new Error('Unrecognized ScriptureGlide file format.');
    }

    const curSessions = sessionsRef.current;
    const isFreshDefaultWorkspace =
      curSessions.length === 1 &&
      curSessions[0].id === 'default' &&
      !currentSetFilePathRef.current;

    if (hasUnsavedSetChangesRef.current && !isFreshDefaultWorkspace) {
      if (appModeRef.current === 'select') {
        setAppMode('control');
      }
      setPendingExternalGlideFile({ filePath, filename, data });
      return;
    }

    const mode: 'replace' | 'append' = (isSetPayload || isFreshDefaultWorkspace) ? 'replace' : 'append';
    applyLoadedSetData(data, filePath, filename, mode);
    if (appModeRef.current === 'select') {
      setAppMode('control');
    }
  }, []);

  const openGlideFileFromPath = useCallback(async (filePath: string) => {
    if (!isSupportedGlideFilename(filePath)) return;
    try {
      const content = await invoke<string>('read_glide_file', { path: filePath });
      const data = JSON.parse(content);
      const filename = filePath.split(/[/\\]/).pop() || 'Loaded Study.glide';
      openExternalGlidePayload(data, filePath, filename);
    } catch (err: any) {
      console.error('Failed to open .glide file from path:', err);
      await showLoadErrorMessage('Open Error', `Failed to open "${filePath.split(/[/\\]/).pop() || filePath}": ${err?.message || err}`);
    }
  }, [openExternalGlidePayload, showLoadErrorMessage]);

  const openGlideFileFromFile = useCallback(async (file: File) => {
    if (!isSupportedGlideFilename(file.name)) return;
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      openExternalGlidePayload(data, null, file.name);
    } catch (err: any) {
      console.error('Failed to open dropped .glide file:', err);
      await showLoadErrorMessage('Open Error', `Failed to open "${file.name}": ${err?.message || err}`);
    }
  }, [openExternalGlidePayload, showLoadErrorMessage]);

  const isPresentMode = appMode === 'present';

  useEffect(() => {
    if (!isTauriApp || isPresentMode) return;

    let cancelled = false;
    let unlistenOpenFile: UnlistenFn | undefined;
    let unlistenDragDrop: UnlistenFn | undefined;

    invoke<string[]>('take_pending_open_files')
      .then((paths) => {
        if (cancelled || !Array.isArray(paths) || paths.length === 0) return;
        for (const p of paths) {
          void openGlideFileFromPath(p);
        }
      })
      .catch((err) => {
        console.error('Failed to read startup .glide file arguments:', err);
      });

    listen<string>('open-glide-file', (event) => {
      if (cancelled || !event.payload) return;
      void openGlideFileFromPath(event.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenOpenFile = fn;
    });

    getCurrentWindow().onDragDropEvent((event) => {
      if (cancelled) return;
      const payload = event.payload;
      if (payload.type === 'enter') {
        const hasSupported = Array.isArray(payload.paths) && payload.paths.some(isSupportedGlideFilename);
        setIsDraggingGlideFile(hasSupported);
      } else if (payload.type === 'leave') {
        setIsDraggingGlideFile(false);
      } else if (payload.type === 'drop') {
        setIsDraggingGlideFile(false);
        const supportedPaths = (payload.paths || []).filter(isSupportedGlideFilename);
        if (supportedPaths.length === 0) {
          void showLoadErrorMessage('Unsupported File', 'Drop a .glide passage or ScriptureGlide set file to open it.');
          return;
        }
        for (const p of supportedPaths) {
          void openGlideFileFromPath(p);
        }
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenDragDrop = fn;
    }).catch((err) => {
      console.error('Failed to register drag-and-drop listener:', err);
    });

    return () => {
      cancelled = true;
      if (unlistenOpenFile) unlistenOpenFile();
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, [isTauriApp, isPresentMode, openGlideFileFromPath, showLoadErrorMessage]);

  const handleBrowserDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isTauriApp || appMode === 'present') return;
    if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingGlideFile) setIsDraggingGlideFile(true);
    }
  };

  const handleBrowserDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (isTauriApp || appMode === 'present') return;
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingGlideFile(false);
    }
  };

  const handleBrowserDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (isTauriApp || appMode === 'present') return;
    const files: File[] = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length === 0) return;
    e.preventDefault();
    setIsDraggingGlideFile(false);
    const supported = files.filter(f => isSupportedGlideFilename(f.name));
    if (supported.length === 0) {
      await showLoadErrorMessage('Unsupported File', 'Drop a .glide passage or ScriptureGlide set file to open it.');
      return;
    }
    for (const file of supported) {
      await openGlideFileFromFile(file);
    }
  };

  const buildExportSnapshot = (scope: 'current' | 'all', paperStyle: 'white' | 'screen', showVerseNums: boolean, onePerLine: boolean) => {
    const latestSessions = getLatestSessionsSnapshot();
    const targetSessions = scope === 'all'
      ? latestSessions
      : latestSessions.filter(s => s.id === activeSessionIdRef.current);
    const resolvedSessions = targetSessions.length > 0 ? targetSessions : [latestSessions[0]].filter(Boolean);
    const title = scope === 'all'
      ? (currentSetName || 'ScriptureGlide Study Set')
      : (resolvedSessions[0]?.name || currentSetName || 'ScriptureGlide Passage');
    const subtitle = scope === 'all'
      ? `${resolvedSessions.length} passages • ScriptureGlide Export`
      : `${(resolvedSessions[0]?.translation || translation).toUpperCase()} • ScriptureGlide Export`;
    return {
      sessions: resolvedSessions,
      title,
      subtitle,
      paperStyle,
      showVerseNumbers: showVerseNums,
      oneVersePerLine: onePerLine
    };
  };

  const openExportModal = (defaultScope: 'current' | 'all' = 'current') => {
    setShowLibrarySetMenu(false);
    setExportScope(defaultScope);
    setExportShowVerseNumbers(settings.showVerseNumbers);
    setExportOneVersePerLine(settings.oneVersePerLine);
    setShowExportModal(true);
  };

  const escapeHtmlAttr = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const getExportPassageNumber = (verse: Verse, index: number) => {
    const fullRef = verse.reference.split(' ').pop() || '';
    return (index === 0 || verse.isNewChapter || verse.isNewPassage) ? fullRef : (fullRef.split(':')[1] || fullRef);
  };

  const buildExportHtmlDocument = (snapshot: NonNullable<typeof exportPrintSnapshot>) => {
    const isWhite = snapshot.paperStyle === 'white';
    const bgColor = isWhite ? '#ffffff' : settings.pageColor;
    const textColor = isWhite ? '#0f172a' : (settings.theme === 'dark' ? '#f8fafc' : '#0f172a');
    const mutedColor = isWhite ? '#475569' : (settings.theme === 'dark' ? '#94a3b8' : '#475569');
    const borderColor = isWhite ? '#e2e8f0' : (settings.theme === 'dark' ? '#334155' : '#cbd5e1');
    const fontMeta = FONT_OPTIONS.find(f => f.id === settings.fontFamily) || FONT_OPTIONS[0];
    const baseFontSize = Math.min(Math.max(Math.round(settings.textSize * 0.5), 14), 22);

    const sectionsHtml = snapshot.sessions.map((session, sIdx) => {
      const isRtl = session.translation === 'wlc';
      const versesHtml = session.verses.map((v, vIdx) => {
        const vNum = getExportPassageNumber(v, vIdx);
        const vLayout = session.verseLayout?.[v.id];
        const indentLevel = vLayout?.indent || 0;
        const stanzaBreak = !!vLayout?.stanzaBreakBefore;
        const bookHeaderHtml = (v.bookHeader && settings.showBookHeader !== false)
          ? `<div class="book-header">${escapeHtmlAttr(v.bookHeader)}</div>`
          : '';
        const dividerHtml = (v.isNewPassage || v.isNewChapter) ? `<div class="chapter-break"></div>` : '';
        const stanzaHtml = stanzaBreak ? `<div class="stanza-break"></div>` : '';
        const acrosticHtml = v.acrostic ? `<div class="acrostic">${escapeHtmlAttr(v.acrostic)}</div>` : '';
        const numSpan = snapshot.showVerseNumbers
          ? `<span class="verse-num" style="color: ${escapeHtmlAttr(settings.verseNumberColor || '#d97706')};">${escapeHtmlAttr(vNum)}</span>`
          : '';
        const contentHtml = (v.html || escapeHtmlAttr(v.text)).replace(/\u200E/g, '');
        const indentStyle = indentLevel > 0 ? ` style="padding-inline-start: ${indentLevel * 2.2}em;"` : '';
        if (snapshot.oneVersePerLine || v.isNewChapter || v.acrostic || indentLevel > 0 || stanzaBreak) {
          return `${bookHeaderHtml}${dividerHtml}${stanzaHtml}<div class="verse-block"${indentStyle}>${acrosticHtml}<div class="verse-row">${numSpan}<span class="verse-body" dir="auto">${contentHtml}</span></div></div>`;
        }
        return `${bookHeaderHtml}${dividerHtml}<span class="verse-inline">${numSpan}<span class="verse-body" dir="auto">${contentHtml}</span> </span>`;
      }).join('');

      return `
        <section class="passage-section${sIdx > 0 ? ' page-break' : ''}" dir="${isRtl ? 'rtl' : 'ltr'}">
          <header class="passage-header">
            <div class="passage-title">${escapeHtmlAttr(session.name)}</div>
            <div class="passage-meta">${escapeHtmlAttr(session.translation.toUpperCase())} • ${session.verses.length} verse${session.verses.length === 1 ? '' : 's'}</div>
          </header>
          <div class="passage-content">${versesHtml}</div>
        </section>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlAttr(snapshot.title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&family=Caveat:wght@400;700&family=Montserrat:wght@400;600;700&family=Fira+Sans:ital,wght@0,400;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&family=Pacifico&display=swap" />
  <style>
    :root {
      --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
      --font-display: "Outfit", sans-serif;
      --font-serif: "Crimson Pro", "Georgia", serif;
      --font-mono: "JetBrains Mono", ui-monospace, monospace;
      --font-playfair: "Playfair Display", serif;
      --font-cinzel: "Cinzel", serif;
      --font-merriweather: "Merriweather", serif;
      --font-lora: "Lora", serif;
      --font-caveat: "Caveat", cursive;
      --font-montserrat: "Montserrat", sans-serif;
      --font-fira: "Fira Sans", sans-serif;
      --font-garamond: "EB Garamond", serif;
      --font-courier: "Courier Prime", monospace;
      --font-bebas: "Bebas Neue", sans-serif;
      --font-pacifico: "Pacifico", cursive;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 36px 28px 60px;
      background: ${bgColor};
      color: ${textColor};
      font-family: ${fontMeta.css};
    }
    .toolbar {
      max-width: 780px;
      margin: 0 auto 24px;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid ${borderColor};
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-sans);
      font-size: 13px;
    }
    .print-btn {
      background: #d97706;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .page-wrap { max-width: 780px; margin: 0 auto; }
    .passage-section { margin-bottom: 36px; }
    .passage-header {
      border-bottom: 2px solid ${borderColor};
      padding-bottom: 10px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-family: var(--font-sans);
    }
    .passage-title { font-size: 20px; font-weight: 800; }
    .passage-meta { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: ${mutedColor}; font-weight: 700; }
    .passage-content { font-size: ${baseFontSize}px; line-height: ${Math.max(settings.textSpacing, 1.65)}; }
    .book-header { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.45; margin: 18px 0 10px; text-align: center; }
    .chapter-break { height: 14px; }
    .stanza-break { height: 16px; }
    .acrostic { font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.25em; opacity: 0.55; margin-bottom: 4px; font-style: italic; }
    .verse-block { margin-bottom: 12px; }
    .verse-row { display: flex; gap: 10px; align-items: baseline; }
    .verse-inline { display: inline; }
    .verse-num { font-size: 0.72em; font-weight: 700; margin-inline-end: 5px; vertical-align: super; opacity: 0.85; }
    .verse-markup { box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .verse-poetic-tag { position: relative; display: inline; padding: 0 3px; border-radius: 4px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .verse-poetic-tag::after { content: attr(data-glide-tag); display: inline-block; vertical-align: super; font-size: 0.48em; line-height: 0; font-weight: 800; font-family: var(--font-sans); letter-spacing: 0.04em; padding: 5px 5px; margin-inline-start: 3px; border-radius: 999px; background-color: var(--glide-tag-color, #0d9488); color: #ffffff; }
    .verse-poetic-anchor { border-bottom: 2px solid var(--glide-anchor-color, #10b981); border-radius: 3px; padding: 0 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .verse-poetic-anchor::after { content: attr(data-glide-anchor-label); display: inline-block; vertical-align: super; font-size: 0.42em; line-height: 0; font-weight: 800; font-family: var(--font-sans); text-transform: uppercase; letter-spacing: 0.06em; margin-inline-start: 4px; color: var(--glide-anchor-color, #10b981); }
    .verse-poetic-label { display: inline; }
    .verse-poetic-label::after { content: attr(data-glide-label); display: inline-block; vertical-align: super; font-size: 0.42em; line-height: 0; font-weight: 800; font-family: var(--font-sans); text-transform: uppercase; letter-spacing: 0.06em; margin-inline-start: 3px; color: var(--glide-label-color, #10b981); }
    .hide-poetic-labels .verse-poetic-anchor::after, .hide-poetic-labels .verse-poetic-label::after { display: none; }
    @media print {
      @page { margin: 0.6in; }
      body { padding: 0; }
      .no-print { display: none !important; }
      .page-break { break-before: page; page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <span><strong>${escapeHtmlAttr(snapshot.title)}</strong> &mdash; ${escapeHtmlAttr(snapshot.subtitle)}</span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <main class="page-wrap${settings.showPoeticLabels === false ? ' hide-poetic-labels' : ''}">
    ${sectionsHtml}
  </main>
</body>
</html>`;
  };

  const handlePrintPdfExport = () => {
    const snapshot = buildExportSnapshot(exportScope, exportPaperStyle, exportShowVerseNumbers, exportOneVersePerLine);
    setExportPrintSnapshot(snapshot);
    setShowExportModal(false);

    const prevTitle = document.title;
    document.title = snapshot.title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'ScriptureGlide-Export';

    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.title = prevTitle;
          window.removeEventListener('afterprint', restoreTitle);
        }, 1500);
      }, 80);
    });
  };

  const handleSaveHtmlExport = async () => {
    const snapshot = buildExportSnapshot(exportScope, exportPaperStyle, exportShowVerseNumbers, exportOneVersePerLine);
    const htmlDoc = buildExportHtmlDocument(snapshot);
    const safeName = (snapshot.title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'ScriptureGlide-Export') + '.html';

    try {
      if (!isTauriApp) {
        const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
        return;
      }

      const { save, message } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: safeName,
        filters: [{ name: 'HTML Handout', extensions: ['html'] }]
      });
      if (filePath) {
        await writeTextFile(filePath, htmlDoc);
        setShowExportModal(false);
        await message(`Exported HTML handout to "${filePath.split(/[/\\]/).pop()}". You can open it in any browser or print to PDF.`, { title: 'Export Complete', kind: 'info' });
      }
    } catch (err: any) {
      console.error('Failed to export HTML:', err);
      await showLoadErrorMessage('Export Error', `Failed to export HTML: ${err?.message || err}`);
    }
  };
  const stateRef = useRef({ activeVerseIndex, verses, settings, translation, poeticLinks, verseLayout });

  useEffect(() => {
    stateRef.current = { activeVerseIndex, verses, settings, translation, poeticLinks, verseLayout };
  }, [activeVerseIndex, verses, settings, translation, poeticLinks, verseLayout]);

  useEffect(() => {
    if (appMode !== 'present') return;
    
    const updateFromState = (state: any) => {
      console.log('Applying state update:', state);
      if (!state) return;
      
      if (state.verses) {
        setVerses(prev => {
          // Deep equality check to prevent infinite loops if we were syncing back
          if (JSON.stringify(prev) === JSON.stringify(state.verses)) return prev;
          return state.verses;
        });
      }
      if (state.translation) setTranslation(state.translation);
      if (state.settings) {
        setSettings(prev => ({ ...prev, ...state.settings }));
      }
      if (state.activeIndex !== undefined) {
        setActiveVerseIndex(state.activeIndex);
      }
      if (Array.isArray(state.poeticLinks)) {
        setPoeticLinks(prev => (JSON.stringify(prev) === JSON.stringify(state.poeticLinks) ? prev : state.poeticLinks));
      }
      if (state.verseLayout && typeof state.verseLayout === 'object') {
        setVerseLayout(prev => (JSON.stringify(prev) === JSON.stringify(state.verseLayout) ? prev : state.verseLayout));
      }
    };

    if (isTauriApp) {
      invoke('get_state').then(updateFromState).catch(() => {});
      
      let unlisten: UnlistenFn | null = null;
      listen('state-changed', (event: any) => {
        console.log('Tauri state-changed event:', event.payload);
        updateFromState(event.payload);
      }).then(u => unlisten = u);

      return () => {
        if (unlisten) unlisten();
      };
    } else {
      fetch('/api/state')
        .then(res => res.json())
        .then(state => {
          if (state && Object.keys(state).length > 0) {
            updateFromState(state);
          }
        })
        .catch(() => {});

      syncChannel.onmessage = (e) => {
        updateFromState(e.data);
      };

      const eventSource = new EventSource('/api/stream');
      eventSource.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          updateFromState(state);
        } catch (err) {}
      };

      return () => {
        eventSource.close();
      };
    }
  }, [appMode, syncChannel]);

  const syncStateToStorage = useCallback((overrides: {
    index?: number;
    verses?: Verse[];
    settings?: AppSettings;
    poeticLinks?: PoeticLink[];
    verseLayout?: Record<string, VerseLayout>;
    forceDomRead?: boolean;
  } = {}) => {
    if (appMode !== 'control') return;
    
    const targetIndex = overrides.index !== undefined ? overrides.index : stateRef.current.activeVerseIndex;
    let currentVerses = overrides.verses !== undefined ? overrides.verses : stateRef.current.verses;
    let currentPoeticLinks = overrides.poeticLinks !== undefined ? overrides.poeticLinks : stateRef.current.poeticLinks;
    const currentVerseLayout = overrides.verseLayout !== undefined ? overrides.verseLayout : stateRef.current.verseLayout;

    if (overrides.forceDomRead && overrides.verses === undefined) {
      currentVerses = stateRef.current.verses.map((v, i) => {
        const el = document.getElementById(`verse-${i}`);
        if (!el) return v;
        const html = el.innerHTML.replace(/\u200E/g, '');
        if (v.html === html) return v;
        return { ...v, html };
      });
      
      const hasChanged = currentVerses.some((v, i) => v.html !== stateRef.current.verses[i].html);
      if (hasChanged) {
        setVerses(currentVerses);
        setHasUnsavedSetChanges(true);
      }
    }

    if (overrides.poeticLinks === undefined && currentPoeticLinks.length > 0) {
      const combinedHtml = currentVerses.map(v => v.html || '').join('\n');
      const pruned = currentPoeticLinks.filter(
        link => combinedHtml.includes(`data-glide-anchor="${link.fromAnchorId}"`) &&
                combinedHtml.includes(`data-glide-anchor="${link.toAnchorId}"`)
      );
      if (pruned.length !== currentPoeticLinks.length) {
        currentPoeticLinks = pruned;
        setPoeticLinks(pruned);
        setHasUnsavedSetChanges(true);
      }
    }

    const stateToSave = { 
      verses: currentVerses, 
      activeIndex: targetIndex, 
      settings: overrides.settings || stateRef.current.settings,
      translation: stateRef.current.translation,
      poeticLinks: currentPoeticLinks,
      verseLayout: currentVerseLayout
    };

    try {
      syncChannel.postMessage(stateToSave);
    } catch (e) {}

    if (isTauriApp) {
      console.log('Tauri syncing state:', stateToSave);
      invoke('set_state', { state: stateToSave }) 
        .then(() => console.log('Tauri state synced successfully'))
        .catch((err: any) => console.error('Tauri set_state error:', err));
    }
    
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(stateToSave)], { type: 'application/json' });
      navigator.sendBeacon('/api/state', blob);
    } else {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stateToSave)
      }).catch(() => {});
    }

    try {
      if (presentationWinRef.current && !presentationWinRef.current.closed) {
        presentationWinRef.current.postMessage(stateToSave, '*');
      }
    } catch (e) {}
    
    try {
      localStorage.setItem('osb_state', JSON.stringify(stateToSave));
    } catch (e) {}
  }, [appMode, syncChannel]);

  useEffect(() => {
    if (appMode === 'control') {
      // Small timeout to ensure DOM state is ready if forceDomRead is used in future
      const timer = setTimeout(() => {
        syncStateToStorage({ index: activeVerseIndex });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeVerseIndex, settings, translation, appMode, syncStateToStorage]);

  useEffect(() => {
    if (appMode === 'select' || verses.length === 0) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Use data-verse-index for reliable selection across both modes
    const targetSelector = `[data-verse-index="${activeVerseIndex}"]`;
    let firstEl = container.querySelector(targetSelector) as HTMLElement;
    
    if (!firstEl) {
      firstEl = document.getElementById(`verse-${activeVerseIndex}`) as HTMLElement;
    }

    if (!firstEl) return;

    // Calculate center of entire active group
    const lastIdx = Math.min(activeVerseIndex + settings.verseCount - 1, verses.length - 1);
    const lastEl = container.querySelector(`[data-verse-index="${lastIdx}"]`) as HTMLElement || firstEl;

    const groupTop = firstEl.offsetTop;
    const groupBottom = lastEl.offsetTop + lastEl.clientHeight;
    const groupHeight = groupBottom - groupTop;
    const groupCenter = groupTop + (groupHeight / 2);
    
    // In control mode, we have a thick bottom toolbar
    // In present mode, we have a reference box (if enabled)
    // We want the text centered in the REMAINING visual space to the eye
    let chromeHeight = 0;
    if (appMode === 'control') {
      chromeHeight = 140;
    } else if (appMode === 'present') {
      chromeHeight = settings.showReferenceBox ? 140 : 40;
    }
    const visualCenter = (container.clientHeight - chromeHeight) / 2;
    
    // Mathematically center active group in the visual space
    const targetScroll = Math.max(0, groupCenter - visualCenter);
    
    const startScroll = container.scrollTop;
    const distance = targetScroll - startScroll;
    const duration = settings.scrollSpeed || 400; // ms
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutCubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      container.scrollTop = startScroll + distance * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, [activeVerseIndex, settings.scrollSpeed, settings.textSize, settings.textSpacing, settings.verseCount, settings.maxWidth, settings.oneVersePerLine, settings.showVerseNumbers, verses, appMode]);

  const applyFormat = useCallback((command: string, value: string | null = null, skipSync = false) => {
    document.execCommand(command, false, value ?? undefined);
    if (!skipSync) {
      setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 50);
    }
  }, [syncStateToStorage]);

  const expandSelectionToWords = useCallback((selection: Selection) => {
    try {
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      
      // If already has selection, don't expand
      if (!range.collapsed) return;

      let startNode = range.startContainer;
      let startOffset = range.startOffset;

      if (startNode.nodeType === Node.ELEMENT_NODE) {
        if (startNode.childNodes.length > 0) {
          const childIndex = Math.min(startOffset, startNode.childNodes.length - 1);
          startNode = startNode.childNodes[childIndex];
          startOffset = 0;
        }
      }
      
      while (startNode && startNode.nodeType !== Node.TEXT_NODE && startNode.firstChild) {
        startNode = startNode.firstChild;
      }

      if (startNode && startNode.nodeType === Node.TEXT_NODE) {
        const text = startNode.textContent || "";
        let s = startOffset;
        let e = startOffset;
        
        while (s > 0 && !text[s - 1].match(/\s/)) s--;
        while (e < text.length && !text[e].match(/\s/)) e++;
        
        const newRange = document.createRange();
        newRange.setStart(startNode, s);
        newRange.setEnd(startNode, e);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } catch (e) {}
  }, []);

  const applyUnderline = useCallback((
    color: string,
    skipSync = false,
    decoStyle: 'solid' | 'wavy' | 'double' | 'dashed' = 'solid'
  ) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.className = 'verse-markup';
    span.style.textDecoration = 'underline';
    span.style.textDecorationStyle = decoStyle;
    span.style.textDecorationColor = color;
    span.style.textDecorationThickness = '2px';
    span.style.textUnderlineOffset = decoStyle === 'double' ? '5px' : '4px';
    
    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      selection.removeAllRanges();
      if (!skipSync) {
        setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 100);
      }
    } catch (e) {}
  }, [syncStateToStorage]);

  const applyPoeticTag = useCallback((tagText: string, tagColor: string, skipSync = false) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.className = 'verse-markup verse-poetic-tag';
    span.setAttribute('data-glide-tag', tagText);
    span.style.setProperty('--glide-tag-color', tagColor);
    span.style.backgroundColor = `rgba(${parseInt(tagColor.slice(1, 3), 16)},${parseInt(tagColor.slice(3, 5), 16)},${parseInt(tagColor.slice(5, 7), 16)},0.14)`;
    span.style.borderBottom = `2px solid ${tagColor}`;

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      selection.removeAllRanges();
      if (!skipSync) {
        setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 100);
      }
    } catch (e) {}
  }, [syncStateToStorage]);

  const applyPoeticLabel = useCallback((labelText: string, labelColor: string, skipSync = false) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.className = 'verse-markup verse-poetic-label';
    span.setAttribute('data-glide-label', labelText);
    span.style.setProperty('--glide-label-color', labelColor);

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      selection.removeAllRanges();
      if (!skipSync) {
        setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 100);
      }
    } catch (e) {}
  }, [syncStateToStorage]);

  const unwrapDomAnchorById = useCallback((anchorId: string) => {
    const container = containerRef.current;
    if (!container) return;
    const nodes = container.querySelectorAll(`[data-glide-anchor="${anchorId}"]`);
    nodes.forEach(node => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
    });
  }, []);

  const cancelPendingPoeticAnchor = useCallback(() => {
    if (!pendingPoeticAnchor) return;
    unwrapDomAnchorById(pendingPoeticAnchor.anchorId);
    setPendingPoeticAnchor(null);
    setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 80);
  }, [pendingPoeticAnchor, unwrapDomAnchorById, syncStateToStorage]);

  const applyPoeticAnchorStep = useCallback((colorOverride?: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rawRange = selection.getRangeAt(0);
    if (rawRange.collapsed) return;

    const container = containerRef.current;
    if (!container) return;

    const verseEl = (
      rawRange.startContainer.nodeType === Node.ELEMENT_NODE
        ? (rawRange.startContainer as HTMLElement)
        : rawRange.startContainer.parentElement
    )?.closest('[id^="verse-"]') as HTMLElement | null;
    if (!verseEl) return;

    const range = rawRange.cloneRange();
    if (!verseEl.contains(range.endContainer)) {
      range.setEnd(verseEl, verseEl.childNodes.length);
    }
    if (range.collapsed) return;

    const verseWrapper = verseEl.closest('[data-verse-index]');
    const verseIndex = verseWrapper ? parseInt(verseWrapper.getAttribute('data-verse-index') || '0', 10) : stateRef.current.activeVerseIndex;

    const meta = POETIC_LINK_META[poeticLinkType];

    if (!pendingPoeticAnchor) {
      const anchorId = `anc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const color = colorOverride || meta.color;
      const span = document.createElement('span');
      span.className = 'verse-markup verse-poetic-anchor';
      span.setAttribute('data-glide-anchor', anchorId);
      span.setAttribute('data-glide-anchor-label', `${meta.label} 1/2`);
      span.style.setProperty('--glide-anchor-color', color);
      span.style.backgroundColor = `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},0.12)`;

      try {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        selection.removeAllRanges();
        setPendingPoeticAnchor({ anchorId, verseIndex, type: poeticLinkType, color });
        setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 80);
      } catch (e) {}
      return;
    }

    const toAnchorId = `anc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const linkMeta = POETIC_LINK_META[pendingPoeticAnchor.type];
    const span = document.createElement('span');
    span.className = 'verse-markup verse-poetic-anchor';
    span.setAttribute('data-glide-anchor', toAnchorId);
    span.setAttribute('data-glide-anchor-label', linkMeta.label);
    span.style.setProperty('--glide-anchor-color', pendingPoeticAnchor.color);
    span.style.backgroundColor = `rgba(${parseInt(pendingPoeticAnchor.color.slice(1, 3), 16)},${parseInt(pendingPoeticAnchor.color.slice(3, 5), 16)},${parseInt(pendingPoeticAnchor.color.slice(5, 7), 16)},0.12)`;

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      selection.removeAllRanges();

      const firstAnchorEl = container.querySelector(`[data-glide-anchor="${pendingPoeticAnchor.anchorId}"]`);
      if (firstAnchorEl) {
        firstAnchorEl.setAttribute('data-glide-anchor-label', linkMeta.label);
      }

      const newLink: PoeticLink = {
        id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: pendingPoeticAnchor.type,
        label: linkMeta.label,
        color: pendingPoeticAnchor.color,
        fromAnchorId: pendingPoeticAnchor.anchorId,
        toAnchorId
      };

      const updatedVerses = stateRef.current.verses.map((v, i) => {
        const el = document.getElementById(`verse-${i}`);
        if (!el) return v;
        return { ...v, html: el.innerHTML.replace(/\u200E/g, '') };
      });
      const updatedLinks = [...stateRef.current.poeticLinks, newLink];
      setVerses(updatedVerses);
      setPoeticLinks(updatedLinks);
      setPendingPoeticAnchor(null);
      setHasUnsavedSetChanges(true);
      syncStateToStorage({
        index: stateRef.current.activeVerseIndex,
        verses: updatedVerses,
        poeticLinks: updatedLinks
      });
    } catch (e) {}
  }, [pendingPoeticAnchor, poeticLinkType, setPoeticLinks, setVerses, syncStateToStorage]);

  const removePoeticLink = useCallback((linkId: string) => {
    const target = stateRef.current.poeticLinks.find(l => l.id === linkId);
    if (!target) return;

    unwrapDomAnchorById(target.fromAnchorId);
    unwrapDomAnchorById(target.toAnchorId);

    const updatedVerses = stateRef.current.verses.map((v, i) => {
      const el = document.getElementById(`verse-${i}`);
      if (el) return { ...v, html: el.innerHTML.replace(/\u200E/g, '') };
      return v;
    });
    const nextLinks = stateRef.current.poeticLinks.filter(l => l.id !== linkId);

    setVerses(updatedVerses);
    setPoeticLinks(nextLinks);
    setHasUnsavedSetChanges(true);
    syncStateToStorage({
      index: stateRef.current.activeVerseIndex,
      verses: updatedVerses,
      poeticLinks: nextLinks
    });
  }, [setPoeticLinks, setVerses, syncStateToStorage, unwrapDomAnchorById]);

  const toggleActiveVerseIndent = useCallback(() => {
    const idx = stateRef.current.activeVerseIndex;
    const verse = stateRef.current.verses[idx];
    if (!verse) return;

    const currentLayout = stateRef.current.verseLayout || {};
    const existing = currentLayout[verse.id] || {};
    const nextIndent = ((existing.indent || 0) + 1) % 3;
    const nextEntry: VerseLayout = { ...existing, indent: nextIndent };
    if (!nextEntry.indent && !nextEntry.stanzaBreakBefore) {
      const { [verse.id]: _, ...rest } = currentLayout;
      setVerseLayout(rest);
      setHasUnsavedSetChanges(true);
      syncStateToStorage({ verseLayout: rest });
      return;
    }
    const nextLayout = { ...currentLayout, [verse.id]: nextEntry };
    setVerseLayout(nextLayout);
    setHasUnsavedSetChanges(true);
    syncStateToStorage({ verseLayout: nextLayout });
  }, [setVerseLayout, syncStateToStorage]);

  const toggleActiveVerseStanzaBreak = useCallback(() => {
    const idx = stateRef.current.activeVerseIndex;
    const verse = stateRef.current.verses[idx];
    if (!verse) return;

    const currentLayout = stateRef.current.verseLayout || {};
    const existing = currentLayout[verse.id] || {};
    const nextBreak = !existing.stanzaBreakBefore;
    const nextEntry: VerseLayout = { ...existing, stanzaBreakBefore: nextBreak };
    if (!nextEntry.indent && !nextEntry.stanzaBreakBefore) {
      const { [verse.id]: _, ...rest } = currentLayout;
      setVerseLayout(rest);
      setHasUnsavedSetChanges(true);
      syncStateToStorage({ verseLayout: rest });
      return;
    }
    const nextLayout = { ...currentLayout, [verse.id]: nextEntry };
    setVerseLayout(nextLayout);
    setHasUnsavedSetChanges(true);
    syncStateToStorage({ verseLayout: nextLayout });
  }, [setVerseLayout, syncStateToStorage]);

  const applyShape = useCallback((type: 'circle' | 'box', color: string, skipSync = false) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.className = 'verse-markup';
    span.style.border = `2px solid ${color}`;
    span.style.padding = '2px 4px';
    span.style.margin = '0 -2px';
    span.style.borderRadius = type === 'circle' ? '999px' : '4px';
    (span.style as any).boxDecorationBreak = 'clone';
    (span.style as any).WebkitBoxDecorationBreak = 'clone';
    
    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      selection.removeAllRanges();
      if (!skipSync) {
        setTimeout(() => syncStateToStorage({ index: stateRef.current.activeVerseIndex, forceDomRead: true }), 100);
      }
    } catch (e) {}
  }, [syncStateToStorage]);

  const applyEraser = useCallback((skipSync = false) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0).cloneRange();
    const container = containerRef.current;
    if (!container) return;

    const isMarkupNode = (node: Node): boolean => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      const el = node as HTMLElement;
      if (el.getAttribute('contenteditable') === 'false' || el.contentEditable === 'false') return false;
      if (el.classList.contains('select-none')) return false;
      if (el.id && el.id.startsWith('verse-')) return false;
      if (el.getAttribute('data-verse-index') !== null) return false;
      const tag = el.tagName.toUpperCase();
      const style = el.getAttribute('style') || '';
      if (['B', 'I', 'U', 'STRONG', 'EM', 'MARK', 'FONT', 'STRIKE', 'SPAN'].includes(tag)) {
        if (style.length > 0 || el.classList.contains('verse-markup') || tag !== 'SPAN') return true;
      }
      return el.classList.contains('verse-markup');
    };

    const stripNode = (node: Node): Node | DocumentFragment => {
      if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
      const frag = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => frag.appendChild(stripNode(child)));
      if (isMarkupNode(node)) return frag;
      const clone = node.cloneNode(false) as HTMLElement;
      clone.appendChild(frag);
      return clone;
    };

    try {
      const selectedFragment = range.cloneContents();
      const cleanFrag = document.createDocumentFragment();
      Array.from(selectedFragment.childNodes).forEach(child => cleanFrag.appendChild(stripNode(child)));
      const firstInserted = cleanFrag.firstChild;
      const lastInserted = cleanFrag.lastChild;
      range.deleteContents();
      range.insertNode(cleanFrag);
      if (firstInserted && lastInserted) {
        const newRange = document.createRange();
        newRange.setStartBefore(firstInserted);
        newRange.setEndAfter(lastInserted);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } catch (e) {}
    if (!skipSync) {
      setTimeout(() => syncStateToStorage({ forceDomRead: true }), 100);
    }
  }, [syncStateToStorage]);

  const clearFormatting = useCallback(() => {
    applyEraser();
  }, [applyEraser]);

  const applyMarkup = useCallback((toolOverride?: { type: string; value: string | null }) => {
    const tool = toolOverride || activeTool;
    if (!tool) return;
    const selection = window.getSelection();
    if (!selection) return;

    if (selection.isCollapsed) {
      expandSelectionToWords(selection);
    }

    const freshSelection = window.getSelection();
    if (!freshSelection || freshSelection.rangeCount === 0) return;
    
    const isEraser = tool.type === 'eraser';
    const hasSelection = freshSelection.toString().length > 0;
    if (!isEraser && !hasSelection) return;

    if (tool.type === 'poeticLink') {
      applyPoeticAnchorStep();
      return;
    }

    const poeticSteps = poeticSequenceMode === 'chiasm' ? POETIC_CHIASM_STEPS : POETIC_PARALLEL_STEPS;
    const currentPoeticStep = poeticSteps[poeticStepIndex % poeticSteps.length];

    const range = freshSelection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    // Collect involved verses and their sub-ranges FIRST
    const allVerses = Array.from(container.querySelectorAll('[id^="verse-"]'));
    const verseTasks: { el: HTMLElement, startContainer: Node, startOffset: number, endContainer: Node, endOffset: number }[] = [];
    
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;

    allVerses.forEach(v => {
      if (range.intersectsNode(v as Node)) {
        const el = v as HTMLElement;
        let vStartNode: Node = el, vStartOff = 0, vEndNode: Node = el, vEndOff = el.childNodes.length;

        if (el.contains(startContainer)) {
          vStartNode = startContainer;
          vStartOff = startOffset;
        } else {
          vStartNode = el;
          vStartOff = 0;
        }

        if (el.contains(endContainer)) {
          vEndNode = endContainer;
          vEndOff = endOffset;
        } else {
          vEndNode = el;
          vEndOff = el.childNodes.length;
        }

        verseTasks.push({ el, startContainer: vStartNode, startOffset: vStartOff, endContainer: vEndNode, endOffset: vEndOff });
      }
    });

    if (verseTasks.length > 1) {
      verseTasks.forEach(task => {
        try {
          const vRange = document.createRange();
          vRange.setStart(task.startContainer, task.startOffset);
          vRange.setEnd(task.endContainer, task.endOffset);

          if (!vRange.collapsed) {
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(vRange);
              
              if (isEraser) applyEraser(true);
              else if (tool.type === 'underlineColor') applyUnderline(activeMarkupColor, true);
              else if (tool.type === 'underlineWavy') applyUnderline(activeMarkupColor, true, 'wavy');
              else if (tool.type === 'underlineDouble') applyUnderline(activeMarkupColor, true, 'double');
              else if (tool.type === 'underlineDashed') applyUnderline(activeMarkupColor, true, 'dashed');
              else if (tool.type === 'poeticTag') applyPoeticTag(currentPoeticStep.tag, currentPoeticStep.color, true);
              else if (tool.type === 'poeticLabel') applyPoeticLabel(tool.value || poeticLabelPreset, activeMarkupColor, true);
              else if (tool.type === 'circle') applyShape('circle', activeMarkupColor, true);
              else if (tool.type === 'box') applyShape('box', activeMarkupColor, true);
              else {
                const { type, value } = tool;
                const finalValue = (type === 'foreColor' || type === 'backColor') ? (value || activeMarkupColor) : value;
                applyFormat(type, finalValue, true);
              }
            }
          }
        } catch (e) { console.warn("Verse task failed", e); }
      });

      if (tool.type === 'poeticTag') {
        setPoeticStepIndex((poeticStepIndex + 1) % poeticSteps.length);
      }
      
      window.getSelection()?.removeAllRanges();
      const finalRange = document.createRange();
      finalRange.setStartBefore(verseTasks[0].el);
      finalRange.setEndAfter(verseTasks[verseTasks.length - 1].el);
      window.getSelection()?.addRange(finalRange);
      
      setTimeout(() => syncStateToStorage({ forceDomRead: true }), 200);
      return;
    }

    const node = freshSelection.anchorNode;
    if (!node) return;
    
    let isInsideEditable = false;
    let curr: Node | null = node;
    while (curr && curr !== document.body) {
      if (curr === containerRef.current) { isInsideEditable = true; break; }
      curr = curr.parentNode;
    }
    
    if (isInsideEditable) {
      if (isEraser) clearFormatting();
      else if (tool.type === 'underlineColor') applyUnderline(activeMarkupColor);
      else if (tool.type === 'underlineWavy') applyUnderline(activeMarkupColor, false, 'wavy');
      else if (tool.type === 'underlineDouble') applyUnderline(activeMarkupColor, false, 'double');
      else if (tool.type === 'underlineDashed') applyUnderline(activeMarkupColor, false, 'dashed');
      else if (tool.type === 'poeticTag') {
        applyPoeticTag(currentPoeticStep.tag, currentPoeticStep.color);
        setPoeticStepIndex((poeticStepIndex + 1) % poeticSteps.length);
      }
      else if (tool.type === 'poeticLabel') applyPoeticLabel(tool.value || poeticLabelPreset, activeMarkupColor);
      else if (tool.type === 'circle') applyShape('circle', activeMarkupColor);
      else if (tool.type === 'box') applyShape('box', activeMarkupColor);
      else {
        const { type, value } = tool;
        const finalValue = (type === 'foreColor' || type === 'backColor') ? (value || activeMarkupColor) : value;
        applyFormat(type, finalValue);
      }
    }
  }, [activeMarkupColor, activeTool, applyFormat, applyUnderline, applyPoeticTag, applyPoeticLabel, applyPoeticAnchorStep, applyEraser, applyShape, clearFormatting, expandSelectionToWords, poeticLabelPreset, poeticSequenceMode, poeticStepIndex, syncStateToStorage]);

  const applyActiveTool = useCallback(() => {
    applyMarkup();
  }, [applyMarkup]);

  const hexToRgba = useCallback((hex: string, intensity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${intensity})`;
  }, []);

  const toggleTool = useCallback((type: string, value: string | null = null) => {
    if (activeTool && activeTool.type === type && activeTool.value === value) {
      setActiveTool(null);
    } else {
      const newTool = { type, value };
      setActiveTool(newTool);
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        applyMarkup(newTool);
      }
    }
  }, [activeTool, applyMarkup]);

  const clearAllFormatting = useCallback(() => {
    if (!window.confirm("Clear all markup and formatting from the current passage?")) return;
    
    const container = containerRef.current;
    if (!container) return;
    const isRtl = stateRef.current.translation === 'wlc';

    // Step 1: Compute clean verses from live DOM
    const cleanVerses = stateRef.current.verses.map((v, i) => {
      const liveNode = container.querySelector(`#verse-${i}`) as HTMLElement;
      const currentHtml = (liveNode ? liveNode.innerHTML : (v.html || v.text || ""))
        .replace(/\u200E/g, '');
      const tmp = document.createElement('div');
      tmp.innerHTML = currentHtml;
      return { ...v, html: tmp.textContent ?? tmp.innerText ?? v.text ?? "" };
    });

    // Step 2: Write directly to DOM — don't wait for React's render cycle
    cleanVerses.forEach((v, i) => {
      const el = container.querySelector(`#verse-${i}`) as HTMLElement;
      if (el) el.innerHTML = (v.html || v.text || "") + (isRtl ? '' : '\u200E');
    });

    // Step 3: Sync React state and force remount
    setVerses(cleanVerses);
    setPoeticLinks([]);
    setVerseLayout({});
    setPendingPoeticAnchor(null);
    setPoeticStepIndex(0);
    setHasUnsavedSetChanges(true);
    setResetKey(prev => prev + 1);

    // Step 4: Persist — this was the missing call
    syncStateToStorage({ verses: cleanVerses, index: stateRef.current.activeVerseIndex, poeticLinks: [], verseLayout: {} });
  }, [setVerses, setPoeticLinks, setVerseLayout, stateRef, syncStateToStorage]);

  const getActiveReference = useCallback(() => {
    if (!verses.length) return "";
    
    const getFullRef = (ref: string) => {
      if (!ref) return "";
      const normalizedRef = ref.replace(/\./g, '');
      const parts = normalizedRef.split(' ');
      if (parts.length < 2) return ref;
      
      const possibleBook = parts[0].toLowerCase();
      let bookKey = possibleBook;
      let chapterVerse = parts[1];
      
      if (/^[1-3]$/.test(possibleBook) && parts.length > 2) {
        bookKey = `${parts[0]} ${parts[1]}`.toLowerCase();
        chapterVerse = parts[2];
      }
      
      const bookId = BOOK_IDS[bookKey];
      if (bookId && CANONICAL_BOOKS[bookId]) {
        return `${CANONICAL_BOOKS[bookId]} ${chapterVerse}`;
      }
      return ref;
    };

    const first = verses[activeVerseIndex];
    const lastIdx = Math.min(activeVerseIndex + settings.verseCount - 1, verses.length - 1);
    const last = verses[lastIdx];
    
    const rawFirst = getFullRef(first.reference);
    const rawLast = getFullRef(last.reference);

    if (first.id === last.id) return formatReference(rawFirst);
    
    const firstParts = rawFirst.split(':');
    const lastParts = rawLast.split(':');
    
    let combined;
    if (firstParts[0] === lastParts[0] && firstParts.length > 1 && lastParts.length > 1) {
       combined = `${rawFirst}-${lastParts[1]}`;
    } else {
       combined = `${rawFirst} - ${rawLast}`;
    }
    return formatReference(combined);
  }, [activeVerseIndex, settings.verseCount, verses]);

  const fetchWithTimeout = useCallback(async (url: string, options: RequestInit = {}, timeout = 6000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }, []);

  const resetPassage = useCallback(() => {
    const emptyVerses: Verse[] = [];
    setVerses(emptyVerses);
    setActiveVerseIndex(0);
    setHasUnsavedSetChanges(true);
    setResetKey(prev => prev + 1);
    syncStateToStorage({ index: 0, verses: emptyVerses, forceDomRead: true });
  }, [syncStateToStorage]);

  const handleCustomTextSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customTextValue.trim()) return;

    // Split text into paragraphs/lines and treat them as verses
    const lines = customTextValue.split(/\n+/).filter(l => l.trim().length > 0);
    const newVerses: Verse[] = lines.map((line, idx) => ({
      id: `custom-${Date.now()}-${idx}`,
      reference: `Segment ${idx + 1}`,
      text: line.trim(),
      isNewPassage: idx === 0
    }));

    setVerses(newVerses);
    setActiveVerseIndex(0);
    setHasUnsavedSetChanges(true);
    setAppMode('control');
    setShowCustomTextModal(false);
    setCustomTextValue("");
    
    // Use setTimeout to ensure state is committed before DOM read sync
    setTimeout(() => syncStateToStorage({ 
      index: 0, 
      verses: newVerses, 
      forceDomRead: false 
    }), 200);
  }, [customTextValue, syncStateToStorage]);

  const fetchBiblePassage = useCallback(async (isAppend = false, overrideRef?: string, overrideTrans?: string) => {
    let refQuery = (overrideRef || referenceInput).trim();
    if (!refQuery) return;
    
    // Auto-complete book name to chapter 1 if only book is provided
    try {
      const lowerQuery = refQuery.toLowerCase().replace(/\./g, '');
      if (BOOK_IDS[lowerQuery]) {
        refQuery = `${CANONICAL_BOOKS[BOOK_IDS[lowerQuery]]} 1`;
        setReferenceInput(refQuery);
      }
    } catch (e) {
      console.warn("Reference normalization failed", e);
    }
    
    setIsLoading(true);
    setFetchError(null);
    const activeTrans = overrideTrans || translation;
    
    try {
      let fetchedVersesRaw: {id: string, reference: string, text: string, html?: string}[] = [];
      const getCanonicalBookName = (refStr: string) => {
        const lastColonIdx = refStr.lastIndexOf(':');
        const bookChap = lastColonIdx === -1 ? refStr : refStr.substring(0, lastColonIdx).trim();
        const lastSpaceIdx = bookChap.lastIndexOf(' ');
        const bookPart = lastSpaceIdx === -1 ? bookChap : bookChap.substring(0, lastSpaceIdx).trim();
        const bookId = BOOK_IDS[bookPart.toLowerCase().replace(/\./g, '').trim()];
        if (bookId && CANONICAL_BOOKS[bookId]) return CANONICAL_BOOKS[bookId];
        return bookPart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      const getBookNameFromRef = (refStr: string) => {
        const lastColonIdx = refStr.lastIndexOf(':');
        if (lastColonIdx === -1) return refStr;
        const bookChap = refStr.substring(0, lastColonIdx).trim();
        const lastSpaceIdx = bookChap.lastIndexOf(' ');
        if (lastSpaceIdx === -1) return bookChap;
        return bookChap.substring(0, lastSpaceIdx).trim();
      };
      
      const getChapterRange = (ref: string) => {
        const parts = ref.split(' ');
        const range = parts[parts.length - 1];
        const book = parts.slice(0, parts.length - 1).join(' ');
        return { book, range };
      };

      const { book: rawBook, range: rawRange } = getChapterRange(refQuery);
      const canonicalBook = getCanonicalBookName(rawBook);
      // headerName includes the chapter range, currentBookName is just the book
      const headerName = formatReference(`${canonicalBook} ${rawRange}`);
      const currentBookName = canonicalBook; 
      const isBookStart = refQuery.toLowerCase().includes(' 1:1') || refQuery.toLowerCase().includes(' 1:1-');

      if (activeTrans.startsWith('yv-')) {
        const yvKey = "XiJCKjmkQ1e0AlAwkbMKY5nyAIb7T4Y2eAhY8KHiYnuGrqGa";
        const translationIdMap: Record<string, string> = {
          'yv-niv': '111',
          'yv-nlt': '116',
          'yv-nasb': '100',
          'yv-esv': '59'
        };
        const versionId = translationIdMap[activeTrans] || '111';
        const usfmBook = USFM_BOOK_MAP[canonicalBook.toLowerCase()] || canonicalBook.substring(0, 3).toUpperCase();
        const formattedRange = rawRange.replace(':', '.');
        const yvRef = `${usfmBook}.${formattedRange}`;

        let content: string;
        if (isTauriApp) {
          try {
            const rawHtml = await invoke<string>('fetch_youversion', {
              url: `https://api.youversion.com/v1/bibles/${versionId}/passages/${yvRef}?format=html`,
              key: yvKey
            });
            try {
              const data = JSON.parse(rawHtml);
              content = data.data?.content || data.content;
            } catch {
              content = rawHtml;
            }
          } catch (e: any) {
            throw new Error(`Failed to fetch from YouVersion API: ${e.message || e}`);
          }
        } else {
          const res = await fetchWithTimeout(`https://api.youversion.com/v1/bibles/${versionId}/passages/${yvRef}?format=html`, {
            headers: { 'X-YVP-App-Key': yvKey }
          });
          if (!res.ok) throw new Error("Failed to fetch from YouVersion API.");
          const data = await res.json();
          content = data.data?.content || data.content;
        }
        if (!content) throw new Error("Passage not found in YouVersion response.");

        const chapterMatch = rawRange.match(/^(\d+)/);
        const currentChapter = chapterMatch ? chapterMatch[1] : "1";

        const parsedVerses = parseYouVersionHtml(content, currentBookName, currentChapter);
        
        fetchedVersesRaw = parsedVerses.map(v => ({
          id: `yv-${versionId}-${v.reference.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`,
          reference: v.reference,
          text: v.text
        }));

      } else if (activeTrans === 'esv') {
        if (!esvApiKey) throw new Error("Please enter a free API key from api.esv.org.");
        const res = await fetchWithTimeout(`https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(refQuery)}&include-passage-references=false&include-footnotes=false&include-headings=false&include-short-copyright=false`, {
          headers: { 'Authorization': `Token ${esvApiKey}` }
        });
        if (!res.ok) throw new Error("Invalid ESV API Key or request.");
        const data = await res.json();
        if (data.passages && data.passages.length > 0) {
          const cleanText = data.passages[0].replace(/\(ESV\)/g, '').replace(/\n/g, ' ').trim();
          const verseMatches = Array.from(cleanText.matchAll(/\[(\d+)\]\s*(.*?)(?=\s*\[\d+\]|$)/g));
          const chapterMatch = data.canonical.match(/(\d+):/);
          const currentChapter = chapterMatch ? chapterMatch[1] : (data.canonical.match(/(\d+)$/) ? data.canonical.match(/(\d+)$/)[1] : "1");
          if (verseMatches.length > 0) {
            fetchedVersesRaw = verseMatches.map((m: any) => ({
              id: `esv-${m[1]}-${Math.random().toString(36).substr(2, 5)}`, reference: formatReference(`${currentBookName} ${currentChapter}:${m[1]}`), text: m[2].trim()
            }));
          } else {
            fetchedVersesRaw = [{ id: `esv-1-${Math.random().toString(36).substr(2, 5)}`, reference: formatReference(data.canonical), text: cleanText }];
          }
        } else throw new Error("Passage not found.");

      } else if (activeTrans === 'net') {
        const targetUrl = `https://labs.bible.org/api/?passage=${encodeURIComponent(refQuery)}&type=json`;
        let textData = null;
        if (isTauriApp) {
          try {
            textData = await invoke<string>('fetch_url', { url: targetUrl });
          } catch (e: any) {
            throw new Error(`Failed to fetch from labs.bible.org: ${e.message || e}`);
          }
        } else {
          try {
            const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
            if (res.ok) textData = await res.text(); else throw new Error();
          } catch (err1) {
            const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
            if (res.ok) { const proxyData = await res.json(); textData = proxyData.contents; }
            else throw new Error("Network/Proxy connection failed.");
          }
        }
        const jsonData = JSON.parse(textData!);
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          fetchedVersesRaw = jsonData.map((v: any) => ({
            id: `net-${v.bookname}-${v.chapter}-${v.verse}-${Math.random().toString(36).substr(2, 5)}`,
            reference: formatReference(`${currentBookName} ${v.chapter}:${v.verse}`),
            text: v.text.replace(/<[^>]+>/g, '').trim()
          }));
        } else throw new Error("Passage not found.");

      } else if (['wlc', 'lxx', 'clementine', 'tr'].includes(activeTrans)) {
        let bookChap: string;
        let versePart: string | null = null;
        
        const colonIdx = refQuery.lastIndexOf(':');
        if (colonIdx === -1) {
          // No colon, assume whole chapter. E.g., "Judges 1"
          bookChap = refQuery.trim();
          versePart = null;
        } else {
          bookChap = refQuery.substring(0, colonIdx).trim();
          versePart = refQuery.substring(colonIdx + 1).trim();
        }

        const lastSpaceIdx = bookChap.lastIndexOf(' ');
        if (lastSpaceIdx === -1) throw new Error("Parse error.");
        let bookNameRaw = bookChap.substring(0, lastSpaceIdx).trim().toLowerCase().replace(/\./g, '');
        const chapterNum = parseInt(bookChap.substring(lastSpaceIdx + 1), 10);
        const bookId = BOOK_IDS[bookNameRaw];
        if (!bookId) throw new Error(`Book '${bookNameRaw}' not recognized.`);

        let bollsTrans = activeTrans.toUpperCase();
        if (activeTrans === 'clementine') bollsTrans = 'VULG';
        const bollsUrl = `https://bolls.life/get-text/${bollsTrans}/${bookId}/${chapterNum}/`;
        let verseData;
        if (isTauriApp) {
          try {
            const rawText = await invoke<string>('fetch_url', { url: bollsUrl });
            verseData = JSON.parse(rawText);
          } catch (e: any) {
            throw new Error(`Failed to fetch Bolls translation: ${e.message || e}`);
          }
        } else {
          try {
            const res = await fetchWithTimeout(bollsUrl);
            if (res.ok) verseData = await res.json(); else throw new Error();
          } catch (e) {
            const proxyRes = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(bollsUrl)}`);
            const proxyData = await proxyRes.json();
            verseData = JSON.parse(proxyData.contents);
          }
        }
        
        let filtered;
        if (versePart) {
          let startV: number, endV: number;
          if (versePart.includes('-')) {
            const parts = versePart.split('-');
            startV = parseInt(parts[0], 10); endV = parseInt(parts[1], 10);
          } else { startV = parseInt(versePart, 10); endV = startV; }
          filtered = verseData.filter((v: any) => v.verse >= startV && v.verse <= endV);
        } else {
          filtered = verseData;
        }

        fetchedVersesRaw = filtered.map((v: any) => ({
          id: `${activeTrans}-${bookId}-${chapterNum}-${v.verse}-${Math.random().toString(36).substr(2, 5)}`,
          reference: formatReference(`${currentBookName} ${chapterNum}:${v.verse}`),
          text: v.text.replace(/<[^>]+>/g, '').trim()
        }));

      } else if (activeTrans === 'sblgnt') {
        const bookChapPart = refQuery.includes(':') ? refQuery.substring(0, refQuery.lastIndexOf(':')) : refQuery;
        const lastSpaceIdx = bookChapPart.lastIndexOf(' ');
        const bookNameRaw = bookChapPart.substring(0, lastSpaceIdx).toLowerCase().replace(/\./g, '').trim();
        const bookId = BOOK_IDS[bookNameRaw];
        
        const bookMap: Record<number, string> = {
          40: 'MAT', 41: 'MRK', 42: 'LUK', 43: 'JHN', 44: 'ACT', 45: 'ROM', 46: '1CO', 47: '2CO', 48: 'GAL', 49: 'EPH',
          50: 'PHP', 51: 'COL', 52: '1TH', 53: '2TH', 54: '1TI', 55: '2TI', 56: 'TIT', 57: 'PHM', 58: 'HEB', 59: 'JAS',
          60: '1PE', 61: '2PE', 62: '1JN', 63: '2JN', 64: '3JN', 65: 'JUD', 66: 'REV'
        };
        const absBook = bookMap[bookId || 0];
        if (!absBook) throw new Error(`SBLGNT only supports New Testament books.`);
        
        const chapterNum = bookChapPart.substring(lastSpaceIdx + 1);
        const helloaoUrl = `https://bible.helloao.org/api/grc_sbl/${absBook}/${chapterNum}.json`;
        
        const res = await fetchWithTimeout(helloaoUrl);
        if (!res.ok) throw new Error(`Fetch failed from helloao.org for SBLGNT.`);
        const data = await res.json();
        
        if (data.chapter && data.chapter.content) {
          const content = data.chapter.content;
          const versesArray: {id: string, reference: string, text: string}[] = [];

          content.forEach((item: any) => {
            if (item.type === 'verse') {
              const verseText = item.content.map((c: any) => {
                if (typeof c === 'string') return c;
                return "";
              }).join('').trim();

              versesArray.push({
                id: `helloao-${activeTrans}-${absBook}-${chapterNum}-${item.number}`,
                reference: formatReference(`${currentBookName} ${chapterNum}:${item.number}`),
                text: verseText
              });
            }
          });

          const versePart = refQuery.includes(':') ? refQuery.split(':')[1] : null;
          if (versePart) {
            let startV: number, endV: number;
            if (versePart.includes('-')) {
              const parts = versePart.split('-');
              startV = parseInt(parts[0], 10); endV = parseInt(parts[1], 10);
            } else { startV = parseInt(versePart, 10); endV = startV; }
            fetchedVersesRaw = versesArray.filter(v => {
              const vNum = parseInt(v.reference.split(':').pop() || "0");
              return vNum >= startV && vNum <= endV;
            });
          } else {
            fetchedVersesRaw = versesArray;
          }
        } else throw new Error(`Could not parse ${activeTrans.toUpperCase()} content from helloao.org.`);

      } else {
        // Standard translations (WEB, KJV, BBE, etc.) via bible-api.com
        // Check for chapter range like "Genesis 1-2"
        const rangeMatch = refQuery.match(/^(.+?)\s+(\d+)-(\d+)$/);
        if (rangeMatch && !refQuery.includes(':')) {
          const bookName = rangeMatch[1];
          const startChap = parseInt(rangeMatch[2], 10);
          const endChap = parseInt(rangeMatch[3], 10);
          
          let allVerses: any[] = [];
          for (let c = startChap; c <= endChap; c++) {
            const res = await fetchWithTimeout(`https://bible-api.com/${encodeURIComponent(bookName + ' ' + c)}?translation=${activeTrans}`);
            const data = await res.json();
            if (data.verses) {
              allVerses = [...allVerses, ...data.verses];
            }
          }
          if (allVerses.length > 0) {
            fetchedVersesRaw = allVerses.map((v: any) => ({
              id: `${v.book_id}-${v.chapter}-${v.verse}-${Math.random().toString(36).substr(2, 5)}`,
              reference: formatReference(`${currentBookName} ${v.chapter}:${v.verse}`),
              text: v.text.replace(/\n/g, ' ').trim()
            }));
          } else throw new Error("Passage range not found.");
        } else {
          const res = await fetchWithTimeout(`https://bible-api.com/${encodeURIComponent(refQuery)}?translation=${activeTrans}`);
          const data = await res.json();
          if (data.verses && data.verses.length > 0) {
            fetchedVersesRaw = data.verses.map((v: any) => ({
              id: `${v.book_id}-${v.chapter}-${v.verse}-${Math.random().toString(36).substr(2, 5)}`,
              reference: formatReference(`${currentBookName} ${v.chapter}:${v.verse}`),
              text: v.text.replace(/\n/g, ' ').trim()
            }));
          } else throw new Error("Passage not found.");
        }
      }

      if (fetchedVersesRaw.length === 0) throw new Error("Could not find passage.");

      const lastBookName = verses.length > 0 ? getBookNameFromRef(verses[verses.length - 1].reference) : null;
      let needsHeader = !isAppend || currentBookName !== lastBookName || isBookStart;

      const fetchedVerses: Verse[] = fetchedVersesRaw.map((v, i) => {
        const currentRef = v.reference;
        const prevRef = i > 0 ? fetchedVersesRaw[i-1].reference : (isAppend && verses.length > 0 ? verses[verses.length-1].reference : null);
        
        let text = v.text;
        let html = v.html;
        let acrostic = undefined;
        
        // Robust regex to match markers like (Aleph) א, [Aleph] א, or א (Aleph)
        const acrosticRegex = /([(\[][A-Za-z\s]+[)\]]\s*[\u0590-\u05FF][\.:]?|[\u0590-\u05FF][\.:]?\s*[(\[][A-Za-z\s]+[)\]])/;
        const acrosticMatch = text.match(acrosticRegex);
        
        if (acrosticMatch) {
          acrostic = acrosticMatch[0].trim();
          text = text.replace(acrosticMatch[0], '').replace(/\s+/g, ' ').trim();
          if (html) {
            html = html.replace(acrosticMatch[0], '').replace(/\s+/g, ' ').trim();
          }
        }

        const getChapter = (ref: string) => {
          const parts = ref.split(' ');
          const lastPart = parts[parts.length - 1];
          return lastPart.split(':')[0];
        };

        const currentChapter = getChapter(currentRef);
        const prevChapter = prevRef ? getChapter(prevRef) : null;
        const isChapterChange = prevChapter && currentChapter !== prevChapter;

        return {
          ...v,
          text,
          html,
          acrostic,
          bookHeader: (i === 0 && needsHeader) ? headerName : undefined,
          isNewPassage: (i === 0 && isAppend) ? true : false,
          isNewChapter: !!isChapterChange
        };
      });

      const finalVerses = isAppend ? [...verses, ...fetchedVerses] : fetchedVerses;
      
      setVerses(finalVerses);
      setHasUnsavedSetChanges(true);
      if (!isAppend || verses.length === 0) {
        setActiveVerseIndex(0);
        syncStateToStorage({ index: 0, verses: finalVerses, forceDomRead: false });
      } else {
        syncStateToStorage({ index: activeVerseIndex, verses: finalVerses, forceDomRead: false });
      }
    } catch (err: any) {
      setFetchError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [activeVerseIndex, esvApiKey, fetchWithTimeout, referenceInput, settings.defaultTranslation, syncStateToStorage, translation, verses]);

  const activeFont = React.useMemo(() => FONT_OPTIONS.find(f => f.id === settings.fontFamily) || FONT_OPTIONS[0], [settings.fontFamily]);

  if (appMode === 'select') {
    return (
      <div
        className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans relative"
        onDragOver={handleBrowserDragOver}
        onDragLeave={handleBrowserDragLeave}
        onDrop={handleBrowserDrop}
      >
        {isDraggingGlideFile && (
          <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-sm border-4 border-dashed border-amber-500 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <FolderOpen size={44} className="text-amber-500" />
            <p className="text-lg font-display font-bold uppercase tracking-wider text-white">Drop .glide File to Open</p>
            <p className="text-xs text-slate-300">Opens a passage file or full ScriptureGlide set</p>
          </div>
        )}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {/* Header */}
          <div className="md:col-span-2 text-center mb-8">
            <h1 className="text-5xl font-display font-black tracking-tighter uppercase italic mb-2">
              ScriptureGlide
            </h1>
            <p className="text-slate-400 text-sm tracking-[0.2em] font-medium uppercase">Select Operation Mode</p>
          </div>

          {/* Mode 1: Single Monitor */}
          <button 
            onClick={() => {
              setDisplayMode('single');
              setAppMode('control');
              localStorage.setItem('osb_display_mode', 'single');
            }}
            className="group relative bg-slate-900 border border-slate-800 p-12 rounded-3xl text-left transition-all hover:bg-slate-800/50 hover:border-amber-500/50 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Monitor size={120} />
            </div>
            <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center mb-6">
              <Monitor size={24} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Single Monitor</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Classic mode. Controls and presentation live in one window. Perfect for personal study or screen recording.
            </p>
            <div className="flex items-center text-amber-500 text-xs font-bold uppercase tracking-widest gap-2">
              Start Session <ArrowRight size={14} />
            </div>
          </button>

          {/* Mode 2: Multiple Monitor */}
          <button 
            onClick={() => {
              setDisplayMode('dual');
              setAppMode('control');
              localStorage.setItem('osb_display_mode', 'dual');
            }}
            className="group relative bg-slate-900 border border-slate-800 p-12 rounded-3xl text-left transition-all hover:bg-slate-800/50 hover:border-amber-500/50 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Tv size={120} />
            </div>
            <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center mb-6">
              <ScreenShare size={24} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Multiple Monitors</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Professional mode. Tools stay on your monitor while the scripture displays full-screen on the secondary display.
            </p>
            <div className="flex items-center text-amber-500 text-xs font-bold uppercase tracking-widest gap-2">
              Setup Presentation <ArrowRight size={14} />
            </div>
          </button>
        </motion.div>
      </div>
    );
  }

  if (appMode === 'present') {
    return (
      <div 
        ref={containerRef}
        key={`present-${verses.length}`}
        className="h-screen overflow-y-auto no-scrollbar relative flex flex-col transition-colors duration-500 group/present"
        dir={translation === 'wlc' ? 'rtl' : 'ltr'}
        style={{ backgroundColor: settings.pageColor, fontFamily: activeFont.css, color: settings.theme === 'dark' ? '#f8fafc' : '#0f172a' }}
      >
        {/* Windowed Mode Button */}
        {isTauriApp && (
          <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 opacity-0 group-hover/present:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                getCurrentWindow().setFullscreen(false);
                getCurrentWindow().setDecorations(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm border border-white/10 transition-all"
            >
              <Monitor size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Windowed Mode</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (isTauriApp) {
                  // Use the invoke to close the specific presentation window label
                  await invoke('close_presentation_window');
                  // If we are the main window (single monitor mode), we also need to switch state
                  if (new URLSearchParams(window.location.search).get('view') !== 'presentation') {
                    setAppMode('control');
                    const win = getCurrentWindow();
                    await win.setFullscreen(false);
                    await win.setDecorations(true);
                  }
                } else {
                  setAppMode('control');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-white rounded-full backdrop-blur-sm border border-red-500/30 transition-all active:scale-95"
            >
              <XCircle size={18} className="text-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Exit Presentation</span>
            </button>
          </div>
        )}

        <div className="h-[40vh] flex-shrink-0" />
        <div className={`w-full ${poeticLinks.length > 0 ? 'px-14 md:px-24 lg:px-28' : 'px-6 md:px-12 lg:px-16'}`}>
        <div
          ref={presentWrapperRef}
          className={`relative mx-auto w-full transition-all duration-300 ${settings.showPoeticLabels === false ? 'hide-poetic-labels' : ''} ${settings.oneVersePerLine ? 'flex flex-col gap-12' : 'text-start tracking-wide'}`}
          style={{ 
            fontSize: `${settings.textSize}px`, 
            lineHeight: settings.textSpacing, 
            maxWidth: `${settings.maxWidth}px`,
            paddingBottom: '40vh'
          }}
        >
          <PoeticGutterOverlay
            wrapperRef={presentWrapperRef}
            poeticLinks={poeticLinks}
            activeVerseIndex={activeVerseIndex}
            verseCount={settings.verseCount}
            isRtl={translation === 'wlc'}
            isControl={false}
            depsKey={`${activeSessionId}-${verses.length}-${settings.textSize}-${settings.textSpacing}-${settings.maxWidth}-${settings.oneVersePerLine}-${JSON.stringify(verseLayout)}`}
          />
          {verses.map((verse, index) => {
            const fullRef = verse.reference.split(' ').pop() || '';
            const verseNumber = (index === 0 || verse.isNewChapter || verse.isNewPassage) ? fullRef : (fullRef.split(':')[1] || fullRef);
            const isActive = index >= activeVerseIndex && index < activeVerseIndex + settings.verseCount;
            const isLinkedPartner = !isActive && linkedPartnerVerseIndices.has(index);
            const isRtl = translation === 'wlc';
            const vLayout = verseLayout[verse.id];
            const indentLevel = vLayout?.indent || 0;
            const stanzaBreak = !!vLayout?.stanzaBreakBefore;
            const isBlock = settings.oneVersePerLine || verse.isNewChapter || verse.acrostic || indentLevel > 0 || stanzaBreak;

            return (
              <React.Fragment key={verse.id}>
                {verse.bookHeader && settings.showBookHeader !== false && (
                  <div className="w-full text-center py-16 md:py-24 opacity-40 select-none">
                    <h2 className="font-bold uppercase tracking-widest break-words" style={{ fontFamily: activeFont.css, fontSize: `${(settings.bookHeaderSize || 64) * 1.5}px` }}>
                      {verse.bookHeader}
                    </h2>
                  </div>
                )}
                {(verse.isNewPassage || verse.isNewChapter) && <div className="h-12 w-full" />}
                {stanzaBreak && <div className="h-6 w-full" />}
                <div 
                  id={`ref-${index}`}
                  className={`${isBlock ? 'flex flex-col items-start w-full' : 'inline'}`}
                  style={{
                    unicodeBidi: 'plaintext',
                    ...(indentLevel > 0 ? { paddingInlineStart: `${indentLevel * 2.2}em` } : {})
                  }}
                  data-verse-index={index}
                >
                  {verse.acrostic && (
                    <div className="w-full opacity-30 text-[0.45em] tracking-[0.3em] uppercase italic mb-1 flex items-center gap-4" style={{ fontFamily: activeFont.css }}>
                      {verse.acrostic}
                      <div className="h-px flex-1 bg-current opacity-20" />
                    </div>
                  )}
                  <div className={`${isBlock ? 'flex gap-6 items-start w-full' : 'inline'}`}>
                    {settings.showVerseNumbers && (
                      <span
                        className={`text-[0.6em] select-none mr-2 transition-all ${isActive ? 'opacity-40' : isLinkedPartner ? 'opacity-30' : 'opacity-10 blur-[2px]'} ${isBlock || verse.isNewPassage ? 'mt-3 flex-shrink-0' : 'inline-block align-top mt-1'}`}
                        style={{ color: settings.verseNumberColor, fontFamily: activeFont.css }}
                      >
                        {verseNumber}
                      </span>
                    )}                    <span
                      id={isActive ? `verse-${index}` : `present-verse-${index}`}
                      className={`transition-all outline-none leading-relaxed ${isActive ? '' : isLinkedPartner ? 'opacity-70' : 'opacity-20 blur-[2px]'}`}
                      style={{ transitionDuration: `${settings.scrollSpeed}ms` }}
                      dangerouslySetInnerHTML={{ __html: (verse.html || verse.text) + (isRtl ? '' : '\u200E') }}
                    />
                  </div>
                  {!isBlock && <span className="inline"> </span>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        </div>

        <AnimatePresence>
          {verses.length > 0 && settings.showReferenceBox && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
            >
              <div 
                className="px-8 py-3 rounded-lg shadow-2xl tracking-widest whitespace-nowrap uppercase font-display font-bold ring-1 ring-amber-500/30" 
                style={{ 
                  fontSize: `${Math.max(settings.textSize * 0.45, 14)}px`,
                  backgroundColor: settings.referenceBoxColor || (settings.theme === 'dark' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.95)'),
                  color: (settings.referenceBoxColor && !settings.referenceBoxColor.startsWith('rgba(15')) ? (parseInt(settings.referenceBoxColor.replace('#',''), 16) > 0xffffff/2 ? '#0f172a' : '#f8fafc') : (settings.theme === 'dark' ? '#0f172a' : '#f8fafc'),
                  backdropFilter: 'blur(12px)'
                }}
              >
                {getActiveReference()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
    <div 
      className={`h-screen flex flex-col transition-colors duration-500 overflow-hidden relative selection:bg-blue-300/40 dark:selection:bg-blue-900/50 print:hidden`}
      style={{ 
        backgroundColor: settings.pageColor,
        fontFamily: activeFont.css
      }}
      onDragOver={handleBrowserDragOver}
      onDragLeave={handleBrowserDragLeave}
      onDrop={handleBrowserDrop}
    >
      {isDraggingGlideFile && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-sm border-4 border-dashed border-amber-500 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <FolderOpen size={44} className="text-amber-500" />
          <p className="text-lg font-display font-bold uppercase tracking-wider text-white">Drop .glide File to Open</p>
          <p className="text-xs text-slate-300">Loads your ScriptureGlide bundle or marked-up passage</p>
        </div>
      )}
      <AnimatePresence>
      </AnimatePresence>

      <AnimatePresence>
        {showCustomTextModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-2xl ${uiBg} border ${uiBorder} rounded-[2.5rem] shadow-2xl p-8 overflow-hidden`}
            >
              <form onSubmit={handleCustomTextSubmit} className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 mb-1">External Data</span>
                    <h3 className={`text-2xl ${uiText} font-display font-black italic uppercase tracking-tighter`}>Paste Content</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowCustomTextModal(false)} 
                    className={`w-10 h-10 flex items-center justify-center rounded-full ${uiBtnBg} ${uiTextMuted} hover:text-amber-500 transition-colors`}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className={`text-xs ${uiTextMuted} leading-relaxed`}>
                    Paste your quotes, sermons, or arbitrary text below. Each paragraph will be treated as an interactive segment for markup.
                  </p>
                  <textarea 
                    autoFocus
                    value={customTextValue}
                    onChange={(e) => setCustomTextValue(e.target.value)}
                    placeholder="Type or paste your text here..."
                    className={`w-full h-64 ${uiTheme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 ${uiBorder} rounded-2xl p-6 ${uiText} text-lg focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all resize-none placeholder:text-slate-600`}
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCustomTextModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl text-sm transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-[0.2em] transition-all shadow-lg shadow-amber-900/30 active:scale-95"
                  >
                    Import Content
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <input
        ref={browserSetInputRef}
        type="file"
        accept=".glide,.json"
        className="hidden"
        onChange={handleBrowserSetFileChange}
      />

      <AnimatePresence>
        {showUnsavedSetModal && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className={`w-full max-w-md ${uiBg} border ${uiBorder} rounded-3xl shadow-2xl p-6 overflow-hidden font-sans`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500 block mb-1">
                    Unsaved Library Set
                  </span>
                  <h3 className={`text-xl ${uiText} font-display font-black uppercase tracking-tight`}>
                    Save before replacing?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnsavedSetModal(false)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${uiBtnBg} ${uiTextMuted} hover:text-amber-500 transition-colors`}
                >
                  <X size={16} />
                </button>
              </div>
              <p className={`text-xs ${uiTextMuted} leading-relaxed mb-6`}>
                Your current Library has unsaved passages or markup{currentSetName ? ` (${currentSetName})` : ''}. Do you want to save this set before replacing it?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const saved = await saveSet(false);
                    if (saved) {
                      setShowUnsavedSetModal(false);
                      performLoadSet('replace');
                    }
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={14} /> Save &amp; Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedSetModal(false);
                    performLoadSet('replace');
                  }}
                  className={`w-full ${uiBtnBg} ${uiBtnHover} ${uiText} border ${uiBorder} font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95`}
                >
                  Replace Without Saving
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnsavedSetModal(false)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold ${uiTextMuted} hover:text-amber-500 transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingExternalGlideFile && (
          <div className="fixed inset-0 z-[315] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className={`w-full max-w-md ${uiBg} border ${uiBorder} rounded-3xl shadow-2xl p-6 overflow-hidden font-sans`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500 block mb-1">
                    Open .glide File
                  </span>
                  <h3 className={`text-xl ${uiText} font-display font-black uppercase tracking-tight break-words`}>
                    {pendingExternalGlideFile.filename.replace(/\.glide$/i, '')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingExternalGlideFile(null)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${uiBtnBg} ${uiTextMuted} hover:text-amber-500 transition-colors shrink-0`}
                >
                  <X size={16} />
                </button>
              </div>
              <p className={`text-xs ${uiTextMuted} leading-relaxed mb-6`}>
                Your current Library has unsaved changes{currentSetName ? ` (${currentSetName})` : ''}. How would you like to open this file?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const target = pendingExternalGlideFile;
                    const saved = await saveSet(false);
                    if (saved && target) {
                      setPendingExternalGlideFile(null);
                      applyLoadedSetData(target.data, target.filePath, target.filename, 'replace');
                    }
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={14} /> Save Current &amp; Open
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = pendingExternalGlideFile;
                    setPendingExternalGlideFile(null);
                    if (target) applyLoadedSetData(target.data, target.filePath, target.filename, 'replace');
                  }}
                  className={`w-full ${uiBtnBg} ${uiBtnHover} ${uiText} border ${uiBorder} font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95`}
                >
                  Replace Without Saving
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = pendingExternalGlideFile;
                    setPendingExternalGlideFile(null);
                    if (target) applyLoadedSetData(target.data, target.filePath, target.filename, 'append');
                  }}
                  className={`w-full ${uiBtnBg} ${uiBtnHover} ${uiText} border ${uiBorder} font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95`}
                >
                  Append to Current Library
                </button>
                <button
                  type="button"
                  onClick={() => setPendingExternalGlideFile(null)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold ${uiTextMuted} hover:text-amber-500 transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[315] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className={`w-full max-w-md ${uiBg} border ${uiBorder} rounded-3xl shadow-2xl p-6 overflow-hidden font-sans`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500 block mb-1">
                    Print &amp; Handout
                  </span>
                  <h3 className={`text-xl ${uiText} font-display font-black uppercase tracking-tight`}>
                    Export Marked-Up Scripture
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${uiBtnBg} ${uiTextMuted} hover:text-amber-500 transition-colors`}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${uiTextMuted} block mb-1.5`}>
                    What to Export
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportScope('current')}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        exportScope === 'current'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                          : `${uiBtnBg} ${uiBorder} ${uiTextMuted}`
                      }`}
                    >
                      <div className="truncate">Current Passage</div>
                      <div className="text-[10px] font-normal opacity-75 truncate">{activeSession.name}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('all')}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        exportScope === 'all'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                          : `${uiBtnBg} ${uiBorder} ${uiTextMuted}`
                      }`}
                    >
                      <div>Entire Library Set</div>
                      <div className="text-[10px] font-normal opacity-75">{sessions.length} passage{sessions.length === 1 ? '' : 's'}</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${uiTextMuted} block mb-1.5`}>
                    Page Background
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportPaperStyle('white')}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        exportPaperStyle === 'white'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                          : `${uiBtnBg} ${uiBorder} ${uiTextMuted}`
                      }`}
                    >
                      White Paper (Ink-Safe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportPaperStyle('screen')}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        exportPaperStyle === 'screen'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                          : `${uiBtnBg} ${uiBorder} ${uiTextMuted}`
                      }`}
                    >
                      Match Screen Theme
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-2 text-xs ${uiText} cursor-pointer select-none`}>
                    <input
                      type="checkbox"
                      checked={exportShowVerseNumbers}
                      onChange={(e) => setExportShowVerseNumbers(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    Verse Numbers
                  </label>
                  <label className={`flex items-center gap-2 text-xs ${uiText} cursor-pointer select-none`}>
                    <input
                      type="checkbox"
                      checked={exportOneVersePerLine}
                      onChange={(e) => setExportOneVersePerLine(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    One Verse Per Line
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handlePrintPdfExport}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Printer size={15} /> Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={handleSaveHtmlExport}
                  className={`w-full ${uiBtnBg} ${uiBtnHover} ${uiText} border ${uiBorder} font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2`}
                >
                  <FileDown size={15} /> Save Printable HTML Handout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appMode === 'control' && !readingMode && (
          <motion.div 
            key="control-header"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="w-full z-[70] font-sans flex-shrink-0 relative"
          >
            <div className={`${uiBg} ${uiText} min-h-[3.5rem] h-auto border-b ${uiBorder} p-2 md:px-4 flex flex-col md:flex-row justify-between items-center gap-3 shadow-lg relative z-[70]`}>
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                <button 
                  onClick={() => {
                    setAppMode('select');
                    localStorage.setItem('osb_mode', 'select');
                  }}
                  className={`p-2 ${uiBtnHover} rounded-lg ${uiTextMuted} hover:text-amber-500 transition-colors`}
                  title="Back to Welcome Screen"
                >
                  <RotateCcw size={18} />
                </button>
                {appMode === 'control' && !readingMode && !sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className={`p-2 ${uiBtnHover} rounded-lg ${uiTextMuted} hover:text-amber-500 transition-colors`}
                    title="Open Sidebar"
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
                <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
                <h1 className="text-lg font-display font-bold tracking-tight hidden lg:block whitespace-nowrap uppercase">
                  ScriptureGlide
                </h1>
                {displayMode === 'dual' && (
                  <button 
                    onClick={togglePresentation}
                    className={`flex items-center gap-2 px-3 py-1 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 ${
                      isPresenting 
                        ? 'bg-red-600/20 text-red-500 border-red-500/30 hover:bg-red-600/30' 
                        : 'bg-amber-600/20 text-amber-500 border-amber-500/30 hover:bg-amber-600/30'
                    }`}
                  >
                    <Tv size={12} /> {isPresenting ? 'Exit Presentation' : 'Present'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2 w-full lg:w-auto">
                <button 
                  onClick={saveStudy}
                  className={`p-2 ${uiBtnBg} border ${uiBorder} rounded-lg ${uiTextMuted} hover:text-amber-500 ${uiBtnHover} transition-all flex items-center justify-center`}
                  title="Save Passage Markup (.glide)"
                >
                  <Save size={18} />
                </button>
                <button 
                  onClick={loadStudy}
                  className={`p-2 ${uiBtnBg} border ${uiBorder} rounded-lg ${uiTextMuted} hover:text-amber-500 ${uiBtnHover} transition-all flex items-center justify-center`}
                  title="Load Passage Markup (.glide)"
                >
                  <FolderOpen size={18} />
                </button>
                <button 
                  onClick={() => openExportModal('current')}
                  className={`p-2 ${uiBtnBg} border ${uiBorder} rounded-lg ${uiTextMuted} hover:text-amber-500 ${uiBtnHover} transition-all flex items-center justify-center`}
                  title="Export Marked-Up Passage (PDF / HTML)"
                >
                  <FileDown size={18} />
                </button>
                <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
                <button 
                  onClick={() => setShowCustomTextModal(true)}
                  className={`px-3 h-9 ${uiBtnBg} border ${uiBorder} rounded ${uiTextMuted} hover:text-amber-500 ${uiBtnHover} transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest`}
                  title="Paste Custom Text"
                >
                  <Type size={14} /> Custom Text
                </button>
                <div className="flex items-center gap-1">
                  <input 
                    type="text" 
                    value={referenceInput} 
                    onChange={(e) => setReferenceInput(e.target.value)} 
                    placeholder="Reference..." 
                    className={`px-4 h-9 ${uiBtnBg} border ${uiBorder} rounded ${uiText} text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-32 md:w-36`} 
                    onKeyDown={(e) => e.key === 'Enter' && fetchBiblePassage(false)}
                  />
                </div>
                <select 
                  value={translation} 
                  onChange={(e) => {
                    const newTrans = e.target.value;
                    setTranslation(newTrans);
                    setVerses([]);
                    fetchBiblePassage(false, referenceInput, newTrans);
                  }}
                  className={`px-3 h-9 ${uiBtnBg} ${uiText} border ${uiBorder} rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500`}
                >
                  {TRANSLATIONS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button 
                  onClick={() => fetchBiblePassage(false)} 
                  disabled={isLoading} 
                  title="Fetch Passage"
                  className="flex items-center h-9 justify-center w-10 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white rounded text-xs font-bold transition-colors uppercase tracking-wider relative"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={18} />}
                </button>
                <AnimatePresence>
                  {fetchError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-16 left-0 right-0 mx-auto w-max max-w-sm bg-red-500 text-white p-3 rounded-lg shadow-xl text-[10px] font-medium z-50 leading-tight border border-red-400"
                    >
                      <p className="flex flex-col gap-1">
                        <span className="font-bold uppercase tracking-widest text-[8px] opacity-80">Fetch Tip:</span>
                        {fetchError}
                      </p>
                      <button onClick={() => setFetchError(null)} className="absolute -top-2 -right-2 bg-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-slate-700 hover:bg-slate-800">×</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  onClick={() => setReadingMode(!readingMode)}
                  className={`p-2 transition-colors rounded-lg flex items-center gap-2 ${readingMode ? 'bg-amber-500 text-slate-900' : `${uiBtnBg} ${uiTextMuted} hover:text-amber-500`}`}
                  title={readingMode ? "Exit Reading Mode" : "Enter Reading Mode"}
                >
                  {readingMode ? <Monitor size={18} /> : <Book size={18} />}
                  <span className="text-[10px] font-bold uppercase hidden xl:inline">{readingMode ? 'Edit Mode' : 'Reading Mode'}</span>
                </button>
                <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
                <button 
                  onClick={() => setShowSettings(!showSettings)} 
                  className={`p-2 h-9 w-9 flex items-center justify-center rounded transition-colors ${showSettings ? 'bg-amber-500 text-slate-900' : `${uiBtnBg} ${uiTextMuted} ${uiBtnHover}`}`}
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
            
            <AnimatePresence>
              {!readingMode && showSettings && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`absolute top-16 right-4 w-72 ${uiBg} border ${uiBorder} rounded-xl shadow-2xl p-5 z-[100] flex flex-col gap-6 max-h-[80vh] overflow-y-auto no-scrollbar pb-32`}
                >
                  <div className="space-y-4">
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTextMuted}`}>Theme Engine</h3>
                    <div className={`flex gap-2 ${uiTheme === 'dark' ? 'bg-slate-950/30' : 'bg-white'} p-1 rounded-lg border ${uiBorder} shadow-sm`}>
                      <button onClick={() => setSettings({...settings, theme: 'light', pageColor: '#f8fafc'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs transition-all ${settings.theme === 'light' ? 'bg-amber-500 text-slate-900 font-bold' : `${uiTextMuted} hover:bg-amber-500/10`}`}><Sun size={14} /> Light</button>
                      <button onClick={() => setSettings({...settings, theme: 'dark', pageColor: '#0f172a'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs transition-all ${settings.theme === 'dark' ? 'bg-slate-900 text-white font-bold' : `${uiTextMuted} hover:bg-slate-900/10`}`}><Moon size={14} /> Dark</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTextMuted}`}>Control Interface Theme</h3>
                    <div className={`flex gap-2 ${uiTheme === 'dark' ? 'bg-slate-950/30' : 'bg-white'} p-1 rounded-lg border ${uiBorder} shadow-sm`}>
                      <button onClick={() => setSettings({...settings, uiTheme: 'light'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs transition-all ${settings.uiTheme === 'light' ? 'bg-amber-500 text-slate-900 font-bold' : `${uiTextMuted} hover:bg-amber-500/10`}`}><Sun size={14} /> Light</button>
                      <button onClick={() => setSettings({...settings, uiTheme: 'dark'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs transition-all ${settings.uiTheme === 'dark' ? 'bg-slate-900 text-white font-bold' : `${uiTextMuted} hover:bg-slate-900/10`}`}><Moon size={14} /> Dark</button>
                    </div>
                  </div>

                  <div className={`space-y-4 border-t ${uiBorder} pt-4`}>
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Page Settings</h3>
                    <div className={`${uiTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} p-3 rounded-lg border ${uiBorder} shadow-sm ${uiText}`}>
                      <label className={`flex justify-between text-[10px] font-bold ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-widest mb-2`}>
                        <span>Max Page Width</span>
                        <span className={`${uiText} font-mono`}>{settings.maxWidth}px</span>
                      </label>
                      <input 
                        type="range" 
                        min="600" 
                        max="2400" 
                        step="40" 
                        value={settings.maxWidth || DEFAULT_SETTINGS.maxWidth} 
                        onChange={(e) => setSettings({...settings, maxWidth: parseInt(e.target.value)})} 
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={`text-[9px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Background Color</label>
                      <div className={`${uiTheme === 'dark' ? 'bg-slate-950/30' : 'bg-white'} p-3 rounded-lg border ${uiBorder} shadow-sm`}>
                        <input 
                          type="color" 
                          value={settings.pageColor || DEFAULT_SETTINGS.pageColor} 
                          onChange={(e) => setSettings({...settings, pageColor: e.target.value})}
                          className="w-full h-8 rounded cursor-pointer border-none bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={`text-[9px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Font Family</label>
                      <select 
                        value={settings.fontFamily || 'academic'} 
                        onChange={(e) => setSettings({...settings, fontFamily: e.target.value})}
                        className={`w-full p-2.5 ${uiTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} border ${uiBorder} rounded-lg text-xs ${uiText} focus:ring-1 focus:ring-amber-500 outline-none shadow-sm`}
                      >
                        {FONT_OPTIONS.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={`space-y-4 border-t ${uiBorder} pt-4`}>
                    {(['textSize', 'textSpacing', 'scrollSpeed', 'verseCount', 'highlightIntensity'] as const).map(key => {
                      const getRange = () => {
                        switch(key) {
                          case 'textSize': return { min: 20, max: 100, step: 1 };
                          case 'textSpacing': return { min: 1, max: 3, step: 0.1 };
                          case 'scrollSpeed': return { min: 200, max: 2500, step: 100 };
                          case 'verseCount': return { min: 1, max: 10, step: 1 };
                          case 'highlightIntensity': return { min: 0.1, max: 1, step: 0.1 };
                          default: return { min: 1, max: 100, step: 1 };
                        }
                      };
                      const { min, max, step } = getRange();
                      
                      return (
                        <div key={key} className={`${uiTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} p-3 rounded-lg border ${uiBorder} shadow-sm ${uiText}`}>
                          <label className={`flex justify-between text-[10px] font-bold ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-widest mb-2`}>
                            <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className={`${uiText} font-mono`}>
                              {key === 'scrollSpeed' ? settings[key]/1000 + 's' : 
                               key === 'highlightIntensity' ? Math.round(settings[key]*100)+'%' : 
                               settings[key]}
                            </span>
                          </label>
                          <input 
                            type="range" 
                            min={min} 
                            max={max} 
                            step={step} 
                            value={settings[key] ?? DEFAULT_SETTINGS[key]} 
                            onChange={(e) => setSettings({...settings, [key]: parseFloat(e.target.value)})} 
                            className={`w-full h-1.5 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} rounded-lg appearance-none cursor-pointer accent-amber-600`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className={`space-y-4 border-t ${uiBorder} pt-4`}>
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Passage Layout</h3>
                    <div className="flex flex-col gap-3 grow">
                      <button 
                        onClick={() => setSettings({...settings, showVerseNumbers: !settings.showVerseNumbers})}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${settings.showVerseNumbers ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : `${uiTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} hover:bg-amber-500/5`}`}
                      >
                        <span>Show Verse Numbers</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showVerseNumbers ? 'bg-amber-500' : (uiTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200')}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.showVerseNumbers ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setSettings({...settings, oneVersePerLine: !settings.oneVersePerLine})}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${settings.oneVersePerLine ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : `${uiTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} hover:bg-amber-500/5`}`}
                      >
                        <span>One Verse Per Line</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.oneVersePerLine ? 'bg-amber-500' : (uiTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200')}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.oneVersePerLine ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setSettings({...settings, showReferenceBox: !settings.showReferenceBox})}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${settings.showReferenceBox ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : `${uiTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} hover:bg-amber-500/5`}`}
                      >
                        <span>Show Reference Box</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showReferenceBox ? 'bg-amber-500' : (uiTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200')}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.showReferenceBox ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>

                      <button 
                        onClick={() => setSettings({...settings, showBookHeader: settings.showBookHeader === false ? true : false})}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${settings.showBookHeader !== false ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-bold' : `${uiTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} hover:bg-amber-500/5`}`}
                      >
                        <span>Show Book Title</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showBookHeader !== false ? 'bg-amber-500' : (uiTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200')}`}>
                          <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.showBookHeader !== false ? 'right-1' : 'left-1'}`} />
                        </div>
                      </button>

                      {settings.showBookHeader !== false && (
                        <div className={`${uiTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} p-3 rounded-lg border ${uiBorder} shadow-sm ${uiText}`}>
                          <label className={`flex justify-between text-[10px] font-bold ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-widest mb-2`}>
                            <span>Title Size</span>
                            <span className={`${uiText} font-mono`}>{settings.bookHeaderSize || 64}px</span>
                          </label>
                          <input 
                            type="range" 
                            min="24" 
                            max="120" 
                            step="2" 
                            value={settings.bookHeaderSize || 64} 
                            onChange={(e) => setSettings({...settings, bookHeaderSize: parseInt(e.target.value)})} 
                            className={`w-full h-1.5 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} rounded-lg appearance-none cursor-pointer accent-amber-600`}
                          />
                        </div>
                      )}

                      <div className="flex flex-col gap-2 mt-2">
                        <label className={`text-[9px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Reference Box Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={settings.referenceBoxColor || DEFAULT_SETTINGS.referenceBoxColor} 
                            onChange={(e) => setSettings({...settings, referenceBoxColor: e.target.value})}
                            className={`w-full h-8 rounded cursor-pointer border ${uiBorder} p-0 overflow-hidden bg-transparent`}
                          />
                          <button 
                            onClick={() => setSettings({...settings, referenceBoxColor: '#1e293b'})}
                            className={`px-2 py-1 ${uiBtnBg} ${uiBtnHover} rounded text-[9px] font-bold ${uiTextMuted} uppercase`}
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-2">
                        <label className={`text-[9px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Verse Number Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            value={settings.verseNumberColor || DEFAULT_SETTINGS.verseNumberColor} 
                            onChange={(e) => setSettings({...settings, verseNumberColor: e.target.value})}
                            className={`w-full h-8 rounded cursor-pointer border ${uiBorder} p-0 overflow-hidden bg-transparent`}
                          />
                          <button 
                            onClick={() => setSettings({...settings, verseNumberColor: '#000000'})}
                            className={`px-2 py-1 ${uiBtnBg} ${uiBtnHover} rounded text-[9px] font-bold ${uiTextMuted} uppercase`}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`space-y-4 border-t ${uiBorder} pt-4`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Presentation Monitor</h3>
                      <button 
                        onClick={() => invoke('list_monitors').then((m: any) => setAvailableMonitors(m)).catch(err => console.error('Monitor refresh error:', err))}
                        className={`text-[8px] uppercase font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1`}
                      >
                        <RotateCcw size={10} /> Refresh
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[9px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Target Monitor</label>
                      <select 
                        value={settings.targetMonitor} 
                        onChange={(e) => {
                          const nextIndex = parseInt(e.target.value, 10);
                          setSettings({...settings, targetMonitor: nextIndex});
                          if (isPresenting && isTauriApp) {
                            invoke('open_presentation_window', { monitorIndex: nextIndex }).catch(err => console.error('Failed to switch monitor:', err));
                          }
                        }}
                        className={`w-full p-2 ${uiTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} border ${uiBorder} rounded text-xs ${uiText} focus:ring-1 focus:ring-amber-500 outline-none shadow-sm`}
                      >
                        {availableMonitors.length > 0 ? (
                          availableMonitors.map(m => (
                            <option key={m.index} value={m.index}>
                              {m.name.replace(/^.*DISPLAY/i, 'Display ')} ({m.width}x{m.height}){m.isPrimary ? ' — Main / Primary' : (typeof m.x === 'number' ? ` — External @ ${m.x}, ${m.y}` : ' — External')}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value={0}>Primary Monitor</option>
                            <option value={1}>Secondary Monitor</option>
                          </>
                        )}
                      </select>
                      {availableMonitors.length > 1 && availableMonitors.every(m => m.x === availableMonitors[0].x && m.y === availableMonitors[0].y) && (
                        <p className="text-[10px] text-amber-500 leading-snug">
                          Windows reports all monitors at the same desktop position (Mirrored). Set displays to Extend in Windows Display Settings to separate the projector from the main screen.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`space-y-4 border-t ${uiBorder} pt-4 pb-4`}>
                    <h3 className={`text-[10px] font-bold uppercase tracking-widest ${uiTheme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Application</h3>
                    <button 
                      onClick={() => checkForUpdates(true)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${uiTheme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'} hover:text-amber-500`}
                    >
                      Check for Updates
                    </button>
                    {bridgeError && (
                      <div className="text-[7px] text-red-500 text-center font-mono mt-1 opacity-60">
                        {bridgeError}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden relative">
        <AnimatePresence>
          {appMode === 'control' && !readingMode && sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`h-full border-r ${uiBorder} ${uiBg} flex flex-col flex-shrink-0 overflow-hidden font-sans z-50`}
            >
              <div className="p-3.5 border-b border-slate-700/50 flex justify-between items-center relative">
                <div className="flex items-center gap-2 min-w-0">
                  <Library size={17} className="text-amber-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className={`font-display font-black uppercase tracking-wider text-sm leading-tight ${uiText}`}>Library</span>
                    {(currentSetName || hasUnsavedSetChanges) && (
                      <span className={`text-[9px] truncate ${hasUnsavedSetChanges ? 'text-amber-500' : uiTextMuted}`}>
                        {currentSetName || 'Unsaved set'}{hasUnsavedSetChanges ? ' • unsaved' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" ref={librarySetMenuRef}>
                  <button
                    onClick={() => saveSet(false)}
                    className={`relative p-1.5 rounded-lg ${uiBtnHover} ${uiTextMuted} hover:text-amber-500 transition-colors`}
                    title={currentSetFilePath ? `Save Set (${currentSetName || 'Current Set'})` : 'Save Passage Set (.glide)'}
                  >
                    <Save size={15} />
                    {hasUnsavedSetChanges && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowLibrarySetMenu(prev => !prev)}
                    className={`p-1.5 rounded-lg flex items-center gap-0.5 ${showLibrarySetMenu ? 'bg-amber-500/20 text-amber-500' : `${uiBtnHover} ${uiTextMuted} hover:text-amber-500`} transition-colors`}
                    title="Open or Manage Passage Set"
                  >
                    <FolderOpen size={15} />
                    <ChevronDown size={11} />
                  </button>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className={`p-1.5 rounded-lg ${uiBtnHover} ${uiTextMuted} hover:text-amber-500 transition-colors`}
                    title="Close Sidebar"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <AnimatePresence>
                    {showLibrarySetMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute top-full right-2 mt-1 w-56 ${uiBg} border ${uiBorder} rounded-xl shadow-2xl p-1.5 z-[80] flex flex-col gap-0.5`}
                      >
                        <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${uiTextMuted}`}>
                          Open Passage Set
                        </div>
                        <button
                          onClick={() => requestLoadSet('replace')}
                          className={`w-full text-left px-2.5 py-2 rounded-lg ${uiBtnHover} transition-colors flex flex-col`}
                        >
                          <span className={`text-xs font-semibold ${uiText}`}>Replace Current Set...</span>
                          <span className={`text-[10px] ${uiTextMuted}`}>Clear library &amp; load saved group</span>
                        </button>
                        <button
                          onClick={() => requestLoadSet('append')}
                          className={`w-full text-left px-2.5 py-2 rounded-lg ${uiBtnHover} transition-colors flex flex-col`}
                        >
                          <span className={`text-xs font-semibold ${uiText}`}>Append to Current Set...</span>
                          <span className={`text-[10px] ${uiTextMuted}`}>Add saved passages to library</span>
                        </button>
                        <div className={`h-px ${uiTheme === 'dark' ? 'bg-slate-700/70' : 'bg-slate-200'} my-1`} />
                        <button
                          onClick={() => {
                            setShowLibrarySetMenu(false);
                            saveSet(true);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg ${uiBtnHover} transition-colors flex items-center gap-2`}
                        >
                          <Save size={13} className="text-amber-500 shrink-0" />
                          <span className={`text-xs font-semibold ${uiText}`}>Save Set As...</span>
                        </button>
                        <button
                          onClick={() => openExportModal('all')}
                          className={`w-full text-left px-2.5 py-2 rounded-lg ${uiBtnHover} transition-colors flex items-center gap-2`}
                        >
                          <FileDown size={13} className="text-amber-500 shrink-0" />
                          <span className={`text-xs font-semibold ${uiText}`}>Export Set (PDF / HTML)...</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="p-3 border-b border-slate-700/35 flex flex-col gap-2">
                <button
                  onClick={() => {
                    const newSessionId = `session-${Date.now()}`;
                    const newSession: ScriptureSession = {
                      id: newSessionId,
                      name: 'Genesis 1:1-5 (ESV)',
                      verses: DEFAULT_PASSAGE,
                      translation: 'esv',
                      activeVerseIndex: 0,
                      referenceInput: 'Genesis 1:1-5'
                    };
                    setSessions(prev => [...prev, newSession]);
                    setActiveSessionId(newSessionId);
                    setHasUnsavedSetChanges(true);
                  }}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 active:scale-95"
                >
                  <Plus size={14} /> Add Scripture
                </button>
              </div>

              <Reorder.Group
                as="div"
                axis="y"
                values={sessions}
                onReorder={(newOrder) => {
                  const orderChanged = newOrder.some((s, idx) => s.id !== sessions[idx]?.id);
                  setSessions(newOrder);
                  if (orderChanged) setHasUnsavedSetChanges(true);
                }}
                layoutScroll
                className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1"
              >
                {sessions.map(session => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <Reorder.Item
                      as="div"
                      key={session.id}
                      value={session}
                      onClick={() => selectSession(session.id)}
                      whileDrag={{ scale: 1.02, zIndex: 30, boxShadow: '0 10px 25px rgba(0,0,0,0.35)' }}
                      className={`group flex items-center justify-between gap-2 p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-colors border select-none ${
                        isActive
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 font-medium'
                          : `border-transparent ${uiTextMuted} hover:bg-slate-800/40 hover:text-white`
                      }`}
                    >
                      <GripVertical
                        size={14}
                        className={`shrink-0 opacity-30 group-hover:opacity-75 transition-opacity ${isActive ? 'text-amber-500' : ''}`}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs truncate font-semibold">
                          {session.name}
                        </span>
                        <span className="text-[9px] opacity-65 uppercase tracking-widest mt-0.5">
                          {session.translation.toUpperCase()} • {session.verses.length} verses
                        </span>
                      </div>
                      
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {session.filePath && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              selectSession(session.id);
                              setTimeout(() => saveStudy(), 50);
                            }}
                            className="p-1 rounded hover:bg-slate-700/60 hover:text-amber-500 transition-colors"
                            title="Save Changes"
                          >
                            <Save size={12} />
                          </button>
                        )}
                        {sessions.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const index = sessions.findIndex(s => s.id === session.id);
                              const newSessions = sessions.filter(s => s.id !== session.id);
                              setSessions(newSessions);
                              setHasUnsavedSetChanges(true);
                              if (isActive) {
                                const nextActive = newSessions[Math.min(index, newSessions.length - 1)];
                                selectSession(nextActive.id);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 hover:text-red-500 transition-colors"
                            title="Close Scripture"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          ref={containerRef} 
          className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-16 flex flex-col no-scrollbar relative h-full transition-colors duration-500" 
          style={{ backgroundColor: settings.pageColor, fontFamily: activeFont.css, color: settings.theme === 'dark' ? '#f8fafc' : '#0f172a' }}
          onInput={() => appMode === 'control' && syncStateToStorage({ index: activeVerseIndex, forceDomRead: true })}
          onMouseUp={() => appMode === 'control' && applyActiveTool()}
          onDrop={(e) => {
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) return;
            if (appMode === 'control') {
              e.preventDefault();
              return false;
            }
          } }
        >
        <div className="h-[40vh] flex-shrink-0" />
        <div
          ref={controlWrapperRef}
          key={`${activeSessionId}-${resetKey}`}
          className={`relative mx-auto w-full transition-all duration-300 select-text ${settings.showPoeticLabels === false ? 'hide-poetic-labels' : ''} ${poeticLinks.length > 0 ? 'pl-10 pr-10 md:pl-14 md:pr-14' : ''} ${settings.oneVersePerLine ? 'flex flex-col gap-8' : 'text-start tracking-wide'}`}
          style={{ fontSize: `${settings.textSize}px`, lineHeight: settings.textSpacing, paddingBottom: '40vh', maxWidth: `${settings.maxWidth}px` }}
          dir={translation === 'wlc' ? 'rtl' : 'ltr'}
        >
          <PoeticGutterOverlay
            wrapperRef={controlWrapperRef}
            poeticLinks={poeticLinks}
            activeVerseIndex={activeVerseIndex}
            verseCount={settings.verseCount}
            isRtl={translation === 'wlc'}
            isControl={true}
            onRemoveLink={removePoeticLink}
            depsKey={`${activeSessionId}-${resetKey}-${verses.length}-${settings.textSize}-${settings.textSpacing}-${settings.maxWidth}-${settings.oneVersePerLine}-${JSON.stringify(verseLayout)}`}
          />
          {verses.map((verse, index) => {
            const fullRef = verse.reference.split(' ').pop() || '';
            const verseNumber = (index === 0 || verse.isNewChapter || verse.isNewPassage) ? fullRef : (fullRef.split(':')[1] || fullRef);
            const isRtl = translation === 'wlc';
            const isActive = index >= activeVerseIndex && index < activeVerseIndex + settings.verseCount;
            const isLinkedPartner = !isActive && linkedPartnerVerseIndices.has(index);
            const vLayout = verseLayout[verse.id];
            const indentLevel = vLayout?.indent || 0;
            const stanzaBreak = !!vLayout?.stanzaBreakBefore;
            const isBlock = settings.oneVersePerLine || verse.isNewChapter || verse.acrostic || indentLevel > 0 || stanzaBreak;
            
            return (
              <React.Fragment key={verse.id}>
                {verse.bookHeader && settings.showBookHeader !== false && (
                  <div className="w-full text-center py-12 md:py-16 opacity-40 select-none">
                    <h2 className="font-bold uppercase tracking-widest break-words" style={{ fontFamily: activeFont.css, fontSize: `${settings.bookHeaderSize || 64}px` }}>
                      {verse.bookHeader}
                    </h2>
                  </div>
                )}
                {(verse.isNewPassage || verse.isNewChapter) && <div className="h-8 w-full" />}
                {stanzaBreak && <div className="h-6 w-full" />}
                <div 
                  className={`${isBlock ? 'flex flex-col items-start w-full' : 'inline'}`}
                  style={{
                    unicodeBidi: 'plaintext',
                    ...(indentLevel > 0 ? { paddingInlineStart: `${indentLevel * 2.2}em` } : {})
                  }}
                  data-verse-index={index}
                  onMouseDown={(e) => {
                    // Only change focus if clicking a backgrounded verse
                    if (appMode === 'control' && !isActive) {
                      setActiveVerseIndex(index);
                      syncStateToStorage({ index });
                    }
                  }}
                >
                  {verse.acrostic && (
                    <div className="w-full opacity-30 text-[0.45em] tracking-[0.3em] uppercase italic mb-1 flex items-center gap-4 select-none" contentEditable={false} style={{ fontFamily: activeFont.css }}>
                      {verse.acrostic}
                      <div className="h-px flex-1 bg-current opacity-10" />
                    </div>
                  )}
                  <div className={`${isBlock ? 'flex gap-4 items-start w-full' : 'inline'}`}>
                    {settings.showVerseNumbers && (
                      <span
                        contentEditable={false} 
                        style={{ color: settings.verseNumberColor }}
                        className={`select-none font-bold text-[0.6em] align-top mt-[0.2em] inline-block shrink-0 transition-all ${isRtl ? 'ml-2' : 'mr-2'} ${isActive ? 'opacity-50' : isLinkedPartner ? 'opacity-35' : 'opacity-10 blur-[2px]'}`}
                      >
                        {verseNumber}
                      </span>
                    )}
                    <span 
                      id={`verse-${index}`} 
                      dir="auto" 
                      className={`outline-none transition-all ${appMode === 'control' ? 'cursor-text' : ''} ${isBlock ? 'flex-1' : 'inline'} ${isRtl ? 'text-right' : ''} ${isActive ? 'font-medium opacity-100' : isLinkedPartner ? 'font-normal opacity-65' : 'font-normal opacity-15'}`}
                      style={{ transitionDuration: `${settings.scrollSpeed}ms` }}
                      contentEditable={appMode === 'control'} 
                      suppressContentEditableWarning={true} 
                      dangerouslySetInnerHTML={{ __html: (verse.html || verse.text) + (isRtl ? '' : '\u200E') }}
                      onDrop={(e) => {
                        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) return;
                        e.preventDefault();
                        return false;
                      }}
                      onClick={(e) => {
                        if (appMode === 'control') {
                          // Prevent focus shift if verse is already foregrounded
                          if (isActive) return;
                          
                          const selection = window.getSelection();
                          if ((!selection || selection.toString().length === 0)) {
                            setActiveVerseIndex(index);
                          }
                        }
                      }} 
                      onFocus={(e) => {
                        if (appMode === 'control') {
                          // If it's already active, we don't want to trigger a shift that might move the cursor
                          if (isActive) return;
                          setActiveVerseIndex(index);
                        }
                      }} 
                    />
                  </div>
                  {!(settings.oneVersePerLine || verse.isNewChapter || verse.acrostic) && <span className="inline"> </span>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div className="h-[20vh] flex-shrink-0" />
      </div>
    </div>

        <AnimatePresence>
          {verses.length > 0 && settings.showReferenceBox && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
            >
              <div 
                className="px-8 py-3 rounded-lg shadow-2xl tracking-widest whitespace-nowrap uppercase font-display font-bold ring-1 ring-amber-500/30" 
                style={{ 
                  fontSize: `${Math.max(settings.textSize * 0.45, 14)}px`,
                  backgroundColor: settings.referenceBoxColor || (settings.theme === 'dark' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.95)'),
                  color: (settings.referenceBoxColor && !settings.referenceBoxColor.startsWith('rgba(15')) ? (parseInt(settings.referenceBoxColor.replace('#',''), 16) > 0xffffff/2 ? '#0f172a' : '#f8fafc') : (settings.theme === 'dark' ? '#0f172a' : '#f8fafc'),
                  backdropFilter: 'blur(12px)'
                }}
              >
                {getActiveReference()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence>
        {appMode === 'control' && readingMode && (
          <motion.button
            key="exit-reading-node"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={() => setReadingMode(false)}
            className="fixed bottom-12 right-12 z-[60] bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:bg-amber-500 hover:text-slate-900 transition-all flex items-center gap-3 border border-slate-700 font-sans"
          >
            <RotateCcw size={20} />
            <span className="font-bold uppercase text-xs tracking-widest">Exit Reading Mode</span>
          </motion.button>
        )}

        {appMode === 'control' && !readingMode && (
          <div key="control-footer" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2.5 font-sans w-max max-w-[95vw]">
            {toolbarMode === 'poetic' && (() => {
              const steps = poeticSequenceMode === 'chiasm' ? POETIC_CHIASM_STEPS : POETIC_PARALLEL_STEPS;
              const nextStep = steps[poeticStepIndex % steps.length];
              return (
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 12, opacity: 0 }}
                  className={`flex flex-wrap items-center justify-center gap-2 ${uiBg} ${uiText} px-3 py-1.5 rounded-2xl border ${uiBorder} shadow-xl text-xs`}
                >
                  {/* Structural sequence stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const nextMode = poeticSequenceMode === 'chiasm' ? 'parallel' : 'chiasm';
                        setPoeticSequenceMode(nextMode);
                        setPoeticStepIndex(0);
                      }}
                      className={`px-2 py-1 rounded-lg font-bold uppercase tracking-wider text-[10px] ${uiBtnBg} ${uiBtnHover} transition-colors`}
                      title="Toggle sequence pattern (Chiasm A-B-C-B'-A' vs Parallel A-A'-B-B')"
                    >
                      {poeticSequenceMode === 'chiasm' ? "Chiasm" : "Parallel"}
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPoeticStepIndex((poeticStepIndex + 1) % steps.length);
                        setActiveTool({ type: 'poeticTag', value: null });
                      }}
                      className="px-2 py-0.5 rounded-full text-white font-extrabold text-[11px] shadow-sm transition-transform active:scale-95"
                      style={{ backgroundColor: nextStep.color }}
                      title="Next tag label (click to cycle)"
                    >
                      Next: {nextStep.tag}
                    </button>
                    {poeticStepIndex !== 0 && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setPoeticStepIndex(0); }}
                        className={`p-1 rounded-md ${uiTextMuted} ${uiBtnHover}`}
                        title="Reset tag sequence to A"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>

                  <div className={`w-px h-4 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />

                  {/* Link Rail selector or pending 2-click prompt */}
                  {pendingPoeticAnchor ? (
                    <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-500 font-semibold">
                      <span className="animate-pulse">●</span>
                      <span>Select closing phrase for {POETIC_LINK_META[pendingPoeticAnchor.type].label}</span>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); cancelPendingPoeticAnchor(); }}
                        className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${uiTextMuted} mr-0.5`}>Rail:</span>
                      {(['inclusio', 'parallel', 'chiasm'] as const).map(kind => {
                        const meta = POETIC_LINK_META[kind];
                        const isSelected = poeticLinkType === kind;
                        return (
                          <button
                            key={kind}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setPoeticLinkType(kind);
                              setActiveTool({ type: 'poeticLink', value: null });
                            }}
                            className={`px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${
                              isSelected
                                ? 'text-white shadow-sm'
                                : `${uiBtnBg} ${uiTextMuted} border-transparent ${uiBtnHover}`
                            }`}
                            style={isSelected ? { backgroundColor: meta.color, borderColor: meta.color } : undefined}
                            title={meta.hint}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {poeticLinks.length > 0 && (
                    <>
                      <div className={`w-px h-4 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
                      <div className="flex items-center gap-1 max-w-[260px] overflow-x-auto no-scrollbar">
                        {poeticLinks.map((lnk, idx) => (
                          <button
                            key={lnk.id}
                            onMouseDown={(e) => { e.preventDefault(); removePoeticLink(lnk.id); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0 hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: lnk.color }}
                            title={`Remove ${lnk.label} link #${idx + 1}`}
                          >
                            <span>{lnk.label} #{idx + 1}</span>
                            <X size={10} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className={`w-px h-4 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />

                  {/* Superscript Preset Stamps + Labels Show/Hide Toggle */}
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${uiTextMuted} mr-0.5`}>Sup:</span>
                    {POETIC_LABEL_PRESETS.map(preset => {
                      const isPresetActive = poeticLabelPreset === preset && activeTool?.type === 'poeticLabel';
                      return (
                        <button
                          key={preset}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPoeticLabelPreset(preset);
                            const nextTool = { type: 'poeticLabel', value: preset };
                            setActiveTool(nextTool);
                            const sel = window.getSelection();
                            if (sel && sel.toString().length > 0) {
                              applyMarkup(nextTool);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all border ${
                            poeticLabelPreset === preset
                              ? isPresetActive
                                ? 'shadow-sm'
                                : `${uiBtnBg} ${uiText}`
                              : `${uiBtnBg} ${uiTextMuted} border-transparent ${uiBtnHover}`
                          }`}
                          style={poeticLabelPreset === preset ? { color: activeMarkupColor, borderColor: activeMarkupColor } : undefined}
                          title={`Stamp superscript "${preset}" in active color (applies to selected/underlined phrase)`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const nextShow = settings.showPoeticLabels === false;
                        const nextSettings = { ...settings, showPoeticLabels: nextShow };
                        setSettings(nextSettings);
                        syncStateToStorage({ settings: nextSettings });
                      }}
                      className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        settings.showPoeticLabels !== false
                          ? `${uiBtnBg} text-emerald-500`
                          : `${uiBtnBg} ${uiTextMuted}`
                      }`}
                      title={settings.showPoeticLabels !== false ? 'Hide Superscription Labels Live' : 'Show Superscription Labels Live'}
                    >
                      {settings.showPoeticLabels !== false ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>Labels</span>
                    </button>
                  </div>
                </motion.div>
              );
            })()}

            <div className="flex flex-col md:flex-row items-center gap-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className={`flex items-center gap-2 ${uiBg} ${uiText} p-2 rounded-2xl border ${uiBorder} shadow-2xl`}
            >
              <button 
                onClick={() => { 
                  const i = Math.max(activeVerseIndex - settings.verseCount, 0); 
                  setActiveVerseIndex(i); 
                  syncStateToStorage({ index: i });
                }} 
                className={`p-1 rounded-lg ${uiBtnHover} transition-colors`}
                title={`Previous ${settings.verseCount} Verse(s)`}
              >
                <ChevronUp size={20} />
              </button>
              <div className={`w-px h-8 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <button 
                onClick={() => { 
                  const i = Math.min(activeVerseIndex + settings.verseCount, verses.length - 1); 
                  setActiveVerseIndex(i); 
                  syncStateToStorage({ index: i });
                }} 
                className={`p-1 rounded-lg ${uiBtnHover} transition-colors`}
                title={`Next ${settings.verseCount} Verse(s)`}
              >
                <ChevronDown size={20} />
              </button>
            </motion.div>
            
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className={`flex items-center gap-1 ${uiBg} ${uiText} p-2 rounded-2xl border ${uiBorder} shadow-2xl select-none`}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Mode Toggle Pill: Study | Poetic */}
              <div className={`flex items-center p-1 ${uiTheme === 'dark' ? 'bg-slate-800/80' : 'bg-slate-100'} rounded-xl mr-1`}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setToolbarMode('study');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    toolbarMode === 'study'
                      ? 'bg-amber-500 text-slate-900 shadow-md'
                      : `${uiTextMuted} hover:text-amber-500`
                  }`}
                  title="Standard Study Markup Tools"
                >
                  <Highlighter size={14} />
                  <span className="hidden lg:inline">Study</span>
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setToolbarMode('poetic');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    toolbarMode === 'poetic'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : `${uiTextMuted} hover:text-emerald-500`
                  }`}
                  title="Poetic Structure & Parallelism Mode"
                >
                  <Feather size={14} />
                  <span className="hidden lg:inline">Poetic</span>
                </button>
              </div>

              {toolbarMode === 'study' ? (
                  <div className={`flex items-center gap-1 p-1 ${uiTheme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('backColor', hexToRgba(activeMarkupColor, settings.highlightIntensity)); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'backColor' ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                      title="Highlighter"
                    >
                      <Highlighter size={18} />
                    </button>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('foreColor', activeMarkupColor); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'foreColor' ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                      title="Text Color"
                    >
                      <Type size={18} />
                    </button>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('underlineColor'); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'underlineColor' ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                      title="Color Underline"
                    >
                      <UnderlineIcon size={18} />
                    </button>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('circle'); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'circle' ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                      title="Circle Tool"
                    >
                      <Circle size={18} />
                    </button>
                    <button 
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('box'); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'box' ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                      title="Box Tool"
                    >
                      <Square size={18} />
                    </button>
                  </div>
              ) : (() => {
                const steps = poeticSequenceMode === 'chiasm' ? POETIC_CHIASM_STEPS : POETIC_PARALLEL_STEPS;
                const nextStep = steps[poeticStepIndex % steps.length];
                const activeVerseObj = verses[activeVerseIndex];
                const activeLayout = activeVerseObj ? verseLayout[activeVerseObj.id] : undefined;
                const indentLvl = activeLayout?.indent || 0;
                const hasStanzaBreak = !!activeLayout?.stanzaBreakBefore;

                return (
                  <div className={`flex items-center gap-1 p-1 ${uiTheme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('underlineWavy'); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'underlineWavy' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title="Wavy Underline (Echo / Repeated Motif)"
                    >
                      <Waves size={18} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('underlineDouble'); }}
                      className={`px-3.5 py-2.5 rounded-xl transition-all font-serif font-extrabold text-sm leading-none ${activeTool?.type === 'underlineDouble' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title="Double Underline (Primary Theme / Structural Frame)"
                    >
                      <span className="underline decoration-double underline-offset-4">U</span>
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('underlineDashed'); }}
                      className={`px-3.5 py-2.5 rounded-xl transition-all font-serif font-extrabold text-sm leading-none ${activeTool?.type === 'underlineDashed' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title="Dashed Underline (Contrasting / Antithetical Parallel)"
                    >
                      <span className="underline decoration-dashed underline-offset-4">U</span>
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('poeticTag'); }}
                      className={`px-3 py-2.5 rounded-xl transition-all font-bold text-xs leading-none flex items-center gap-1 ${activeTool?.type === 'poeticTag' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title={`Tag Structural Unit (${poeticSequenceMode}: next "${nextStep.tag}")`}
                    >
                      <span
                        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold text-white"
                        style={{ backgroundColor: nextStep.color }}
                      >
                        {nextStep.tag}
                      </span>
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('poeticLabel', poeticLabelPreset); }}
                      className={`p-3 rounded-xl transition-all relative ${activeTool?.type === 'poeticLabel' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title={`Stamp Superscription Label ("${poeticLabelPreset}" in active color)`}
                    >
                      <Superscript size={18} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleTool('poeticLink'); }}
                      className={`p-3 rounded-xl transition-all ${activeTool?.type === 'poeticLink' || pendingPoeticAnchor ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-emerald-500`}`}
                      title={`2-Click Margin Connector (${POETIC_LINK_META[poeticLinkType].label})`}
                    >
                      <GitCompareArrows size={18} />
                    </button>
                    <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-0.5`} />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleActiveVerseIndent(); }}
                      className={`p-3 rounded-xl transition-all relative ${indentLvl > 0 ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40' : `${uiTextMuted} ${uiBtnHover} hover:text-teal-400`}`}
                      title="Cycle Line Indentation on Active Verse (0 → 1 → 2)"
                    >
                      <ListIndentIncrease size={18} />
                      {indentLvl > 0 && (
                        <span className="absolute top-1 right-1 text-[9px] font-extrabold leading-none">{indentLvl}</span>
                      )}
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); toggleActiveVerseStanzaBreak(); }}
                      className={`p-3 rounded-xl transition-all ${hasStanzaBreak ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40' : `${uiTextMuted} ${uiBtnHover} hover:text-teal-400`}`}
                      title="Toggle Stanza / Strophe Break Above Active Verse"
                    >
                      <SeparatorHorizontal size={18} />
                    </button>
                  </div>
                );
              })()}

              <div className={`w-px h-8 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />

              {['#facc15', '#10b981', '#3b82f6', '#ef4444', '#000000'].map((c,i)=> (
                <button 
                  key={i} 
                  draggable="false"
                  onClick={() => {
                    setActiveMarkupColor(c);
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    if (activeTool?.type === 'backColor') {
                      const value = hexToRgba(c, settings.highlightIntensity);
                      setActiveTool({ type: 'backColor', value });
                      if (hasSelection) applyFormat('backColor', value);
                    } else if (activeTool?.type === 'foreColor') {
                      setActiveTool({ type: 'foreColor', value: c });
                      if (hasSelection) applyFormat('foreColor', c);
                    } else if (activeTool?.type === 'underlineColor') {
                      if (hasSelection) applyUnderline(c);
                    } else if (activeTool?.type === 'underlineWavy') {
                      if (hasSelection) applyUnderline(c, false, 'wavy');
                    } else if (activeTool?.type === 'underlineDouble') {
                      if (hasSelection) applyUnderline(c, false, 'double');
                    } else if (activeTool?.type === 'underlineDashed') {
                      if (hasSelection) applyUnderline(c, false, 'dashed');
                    } else if (activeTool?.type === 'poeticLabel') {
                      if (hasSelection) applyPoeticLabel(activeTool.value || poeticLabelPreset, c);
                    } else if (activeTool?.type === 'poeticLink') {
                      if (hasSelection) applyPoeticAnchorStep(c);
                    } else if (activeTool?.type === 'circle') {
                      if (hasSelection) applyShape('circle', c);
                    } else if (activeTool?.type === 'box') {
                      if (hasSelection) applyShape('box', c);
                    }
                  }} 
                  className={`p-2 rounded-xl transition-all group ${activeMarkupColor === c ? `${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} ring-1 ring-amber-500/50` : uiBtnHover}`}
                >
                  <div 
                    className="w-6 h-6 rounded ring-1 ring-white/10 group-hover:ring-amber-500/50" 
                    style={{ backgroundColor: c }} 
                  />
                </button>
              ))}

              <div className={`relative flex items-center p-2 rounded-xl border border-transparent ${uiBtnHover} transition-colors`}>
                <input 
                  type="color" 
                  value={activeMarkupColor}
                  onChange={(e) => {
                    const c = e.target.value;
                    setActiveMarkupColor(c);
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    if (activeTool?.type === 'backColor') {
                      const value = hexToRgba(c, settings.highlightIntensity);
                      setActiveTool({ type: 'backColor', value });
                      if (hasSelection) applyFormat('backColor', value);
                    } else if (activeTool?.type === 'foreColor') {
                      setActiveTool({ type: 'foreColor', value: c });
                      if (hasSelection) applyFormat('foreColor', c);
                    } else if (activeTool?.type === 'underlineColor') {
                      if (hasSelection) applyUnderline(c);
                    } else if (activeTool?.type === 'underlineWavy') {
                      if (hasSelection) applyUnderline(c, false, 'wavy');
                    } else if (activeTool?.type === 'underlineDouble') {
                      if (hasSelection) applyUnderline(c, false, 'double');
                    } else if (activeTool?.type === 'underlineDashed') {
                      if (hasSelection) applyUnderline(c, false, 'dashed');
                    } else if (activeTool?.type === 'poeticLabel') {
                      if (hasSelection) applyPoeticLabel(activeTool.value || poeticLabelPreset, c);
                    } else if (activeTool?.type === 'poeticLink') {
                      if (hasSelection) applyPoeticAnchorStep(c);
                    } else if (activeTool?.type === 'circle') {
                      if (hasSelection) applyShape('circle', c);
                    } else if (activeTool?.type === 'box') {
                      if (hasSelection) applyShape('box', c);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="w-6 h-6 rounded ring-1 ring-white/20 flex items-center justify-center"
                  style={{ backgroundColor: activeMarkupColor }}
                >
                  <Palette size={12} className={activeMarkupColor === '#ffffff' ? 'text-slate-900' : 'text-white/70'} />
                </div>
              </div>

              <div className={`w-px h-8 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />

              {/* Group 3: Bold, Italic, Eraser */}
              <div className={`flex items-center gap-1 p-1 ${uiTheme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); toggleTool('bold'); }}
                  className={`p-3 rounded-xl transition-all ${activeTool?.type === 'bold' ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                  title="Bold"
                >
                  <BoldIcon size={18} />
                </button>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); toggleTool('italic'); }}
                  className={`p-3 rounded-xl transition-all ${activeTool?.type === 'italic' ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                  title="Italic"
                >
                  <Italic size={18} />
                </button>
                <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
                <button 
                  onMouseDown={(e) => { e.preventDefault(); toggleTool('eraser'); }}
                  className={`p-3 rounded-xl transition-all ${activeTool?.type === 'eraser' ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-lg shadow-amber-500/20' : `${uiTextMuted} ${uiBtnHover} hover:text-amber-500`}`}
                  title="Eraser Tool"
                >
                  <Eraser size={18} />
                </button>
                <div className={`w-px h-6 ${uiTheme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
                <button 
                  onClick={clearAllFormatting}
                  className={`p-3 rounded-xl transition-all ${uiTextMuted} ${uiBtnHover} hover:text-red-500`}
                  title="Clear All Markups"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>

    {exportPrintSnapshot && (
      <div
        id="scriptureglide-print-sheet"
        className={`hidden print:block w-full min-h-screen p-4 ${settings.showPoeticLabels === false ? 'hide-poetic-labels' : ''}`}
        style={{
          backgroundColor: exportPrintSnapshot.paperStyle === 'white' ? '#ffffff' : settings.pageColor,
          color: exportPrintSnapshot.paperStyle === 'white' ? '#0f172a' : (settings.theme === 'dark' ? '#f8fafc' : '#0f172a'),
          fontFamily: activeFont.css
        }}
      >
        {exportPrintSnapshot.sessions.map((session, sIdx) => {
          const isRtl = session.translation === 'wlc';
          const baseFontSize = Math.min(Math.max(Math.round(settings.textSize * 0.5), 14), 22);
          return (
            <section
              key={session.id}
              dir={isRtl ? 'rtl' : 'ltr'}
              className="mb-10"
              style={sIdx > 0 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}
            >
              <header
                className="flex justify-between items-baseline gap-4 pb-2.5 mb-5 border-b-2 font-sans"
                style={{
                  borderColor: exportPrintSnapshot.paperStyle === 'white'
                    ? '#e2e8f0'
                    : (settings.theme === 'dark' ? '#334155' : '#cbd5e1')
                }}
              >
                <h1 className="text-xl font-bold">{session.name}</h1>
                <span className="text-[11px] font-bold uppercase tracking-widest opacity-60 shrink-0">
                  {session.translation.toUpperCase()} • {session.verses.length} verse{session.verses.length === 1 ? '' : 's'}
                </span>
              </header>
              <div
                style={{
                  fontSize: `${baseFontSize}px`,
                  lineHeight: Math.max(settings.textSpacing, 1.65)
                }}
              >
                {session.verses.map((verse, vIdx) => {
                  const verseNumber = getExportPassageNumber(verse, vIdx);
                  const vLayout = session.verseLayout?.[verse.id];
                  const indentLevel = vLayout?.indent || 0;
                  const stanzaBreak = !!vLayout?.stanzaBreakBefore;
                  const blockMode = exportPrintSnapshot.oneVersePerLine || verse.isNewChapter || verse.acrostic || indentLevel > 0 || stanzaBreak;
                  return (
                    <React.Fragment key={`${session.id}-${verse.id}-${vIdx}`}>
                      {verse.bookHeader && settings.showBookHeader !== false && (
                        <div className="w-full text-center py-4 opacity-50">
                          <h2 className="text-2xl font-bold uppercase tracking-widest">{verse.bookHeader}</h2>
                        </div>
                      )}
                      {(verse.isNewPassage || verse.isNewChapter) && <div className="h-3 w-full" />}
                      {stanzaBreak && <div className="h-4 w-full" />}
                      {blockMode ? (
                        <div className="mb-3" style={indentLevel > 0 ? { paddingInlineStart: `${indentLevel * 2.2}em` } : undefined}>
                          {verse.acrostic && (
                            <div className="text-[0.7em] tracking-[0.25em] uppercase italic opacity-60 mb-1">
                              {verse.acrostic}
                            </div>
                          )}
                          <div className="flex gap-2.5 items-baseline">
                            {exportPrintSnapshot.showVerseNumbers && (
                              <span
                                className="font-bold text-[0.72em] shrink-0"
                                style={{ color: settings.verseNumberColor || '#d97706' }}
                              >
                                {verseNumber}
                              </span>
                            )}
                            <span
                              dir="auto"
                              dangerouslySetInnerHTML={{ __html: (verse.html || verse.text).replace(/\u200E/g, '') }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="inline">
                          {exportPrintSnapshot.showVerseNumbers && (
                            <span
                              className="font-bold text-[0.72em] align-super mr-1"
                              style={{ color: settings.verseNumberColor || '#d97706' }}
                            >
                              {verseNumber}
                            </span>
                          )}
                          <span
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: (verse.html || verse.text).replace(/\u200E/g, '') }}
                          />{' '}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    )}
    </>
  );
}
