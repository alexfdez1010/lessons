/**
 * UI string dictionaries (chrome / non-content text).
 * Lesson *content* lives in MDX per locale; this file is only for shared
 * interface labels (nav, buttons, aria text, etc.).
 *
 * Keep keys flat and dotted. Add a key to BOTH locales or `t()` falls back
 * to the English string.
 */
export const languages = {
  en: 'English',
  es: 'Español',
} as const;

export const defaultLang = 'en';
export type Lang = keyof typeof languages;

export const ui = {
  en: {
    'nav.catalog': 'Catalog',
    'nav.github': 'GitHub',
    'nav.skip': 'Skip to content',
    'nav.home': 'Home',
    'hero.cta.start': 'Start learning',
    'hero.cta.catalog': 'Browse catalog',
    'catalog.title': 'Catalog',
    'catalog.subtitle': 'Every topic, taught from scratch.',
    'catalog.lessons': 'lessons',
    'lesson.toc': 'On this page',
    'lesson.minutes': 'min',
    'lesson.updated': 'Updated',
    'lesson.prev': 'Previous',
    'lesson.next': 'Next',
    'lesson.inTopic': 'In this topic',
    'quiz.check': 'Check',
    'quiz.retry': 'Try again',
    'quiz.next': 'Next',
    'quiz.back': 'Back',
    'quiz.question': 'Question',
    'quiz.of': 'of',
    'quiz.score': 'You scored',
    'quiz.restart': 'Restart',
    'copy.copy': 'Copy',
    'copy.copied': 'Copied!',
    'footer.tagline': 'Learn anything, visually.',
    'footer.built': 'Built with Astro.',
    'lang.switch': 'Language',
  },
  es: {
    'nav.catalog': 'Catálogo',
    'nav.github': 'GitHub',
    'nav.skip': 'Saltar al contenido',
    'nav.home': 'Inicio',
    'hero.cta.start': 'Empezar a aprender',
    'hero.cta.catalog': 'Ver catálogo',
    'catalog.title': 'Catálogo',
    'catalog.subtitle': 'Cada tema, explicado desde cero.',
    'catalog.lessons': 'lecciones',
    'lesson.toc': 'En esta página',
    'lesson.minutes': 'min',
    'lesson.updated': 'Actualizado',
    'lesson.prev': 'Anterior',
    'lesson.next': 'Siguiente',
    'lesson.inTopic': 'En este tema',
    'quiz.check': 'Comprobar',
    'quiz.retry': 'Reintentar',
    'quiz.next': 'Siguiente',
    'quiz.back': 'Atrás',
    'quiz.question': 'Pregunta',
    'quiz.of': 'de',
    'quiz.score': 'Tu puntuación',
    'quiz.restart': 'Reiniciar',
    'copy.copy': 'Copiar',
    'copy.copied': '¡Copiado!',
    'footer.tagline': 'Aprende cualquier cosa, de forma visual.',
    'footer.built': 'Hecho con Astro.',
    'lang.switch': 'Idioma',
  },
} as const;

export type UIKey = keyof (typeof ui)['en'];
