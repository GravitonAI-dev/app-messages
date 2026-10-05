// Limpieza del HTML con la lista blanca del contrato (README «HTML admitido»),
// la misma que aplica la app (`sanitizeRemoteHtml`). El validador ya lo exige
// en la CI; esto es la segunda barrera, por si algo se cuela con los valores.
import sanitizeHtml from 'sanitize-html';
import { ATTRS, STYLE_PROPS, TAGS } from '@app-messages/contract';

// Valores de estilo: sin nada que pueda abrir url(), expression() o comillas.
// `{{c.<rol>}}` se deja pasar: la app lo cambia por el color del tema.
const SAFE_STYLE_VALUE = /^(?:(?!url\s*\(|expression\s*\(|javascript:)[^;<>"'\\])*$/i;

const OPTIONS: sanitizeHtml.IOptions = {
  // tbody/thead los mete cualquier parser al leer una tabla; th por si acaso.
  allowedTags: [...TAGS, 'tbody', 'thead', 'tfoot', 'th'],
  allowedAttributes: { '*': ATTRS },
  allowedSchemes: ['https'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  allowedStyles: { '*': Object.fromEntries(STYLE_PROPS.map((p) => [p, [SAFE_STYLE_VALUE]])) },
  disallowedTagsMode: 'discard',
  // Una imagen sin src (no era https) no pinta nada.
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'svg', 'template', 'head', 'title'],
};

// El parser de CSS de sanitize-html descarta un `style` entero si ve llaves,
// así que `{{c.<rol>}}` viaja como un marcador durante la limpieza.
const ROLE = /\{\{\s*c\.([A-Za-z]+)\s*\}\}/g;
const MARK = /__cvar_([A-Za-z]+)__/g;

export const sanitizeMessageHtml = (html: string) =>
  sanitizeHtml(html.replace(ROLE, '__cvar_$1__'), OPTIONS).replace(MARK, '{{c.$1}}');
