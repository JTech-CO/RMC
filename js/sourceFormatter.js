const INDENT = '  ';
const INLINE_SOURCE_ELEMENTS = new Set([
    'a',
    'abbr',
    'b',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'i',
    'li',
    'mark',
    'p',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'td',
    'th',
    'u',
]);
const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

export function formatHtmlSource(html) {
    const template = document.createElement('template');
    template.innerHTML = html ?? '';

    const lines = [];
    template.content.childNodes.forEach((node) => serializeNode(node, 0, lines));
    return lines.join('\n');
}

function serializeNode(node, depth, lines) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeBlockText(node.textContent);
        if (text) {
            lines.push(`${indent(depth)}${escapeHtml(text)}`);
        }
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        serializeElement(node, depth, lines);
    }
}

function serializeElement(element, depth, lines) {
    const tagName = element.tagName.toLowerCase();
    const openingTag = `<${tagName}${formatAttributes(element)}>`;

    if (VOID_ELEMENTS.has(tagName)) {
        lines.push(`${indent(depth)}${openingTag}`);
        return;
    }

    if (tagName === 'pre') {
        serializePreElement(element, depth, lines, openingTag);
        return;
    }

    if (canSerializeInline(element)) {
        lines.push(`${indent(depth)}${openingTag}${serializeInlineChildren(element)}</${tagName}>`);
        return;
    }

    if (canSerializeInlineBlock(element)) {
        lines.push(`${indent(depth)}${openingTag}`);
        serializeInlineSegments(element).forEach((segment) => {
            lines.push(`${indent(depth + 1)}${segment}`);
        });
        lines.push(`${indent(depth)}</${tagName}>`);
        return;
    }

    lines.push(`${indent(depth)}${openingTag}`);
    element.childNodes.forEach((childNode) => serializeNode(childNode, depth + 1, lines));
    lines.push(`${indent(depth)}</${tagName}>`);
}

function serializePreElement(element, depth, lines, openingTag) {
    lines.push(`${indent(depth)}${openingTag}`);

    const codeElement = getSingleCodeChild(element);
    if (codeElement) {
        const codeOpeningTag = `<code${formatAttributes(codeElement)}>`;
        const codeText = codeElement.textContent.replace(/\r\n/g, '\n').replace(/\n$/, '');

        if (codeText.includes('\n')) {
            lines.push(`${indent(depth + 1)}${codeOpeningTag}`);
            codeText.split('\n').forEach((line) => {
                lines.push(`${indent(depth + 2)}${escapeHtml(line)}`);
            });
            lines.push(`${indent(depth + 1)}</code>`);
        } else {
            lines.push(`${indent(depth + 1)}${codeOpeningTag}${escapeHtml(codeText)}</code>`);
        }
    } else {
        lines.push(`${indent(depth + 1)}${element.innerHTML}`);
    }

    lines.push(`${indent(depth)}</pre>`);
}

function getSingleCodeChild(element) {
    const childElements = Array.from(element.children);
    if (childElements.length !== 1) return null;

    const [childElement] = childElements;
    return childElement.tagName.toLowerCase() === 'code' ? childElement : null;
}

function canSerializeInline(element) {
    const tagName = element.tagName.toLowerCase();
    if (!INLINE_SOURCE_ELEMENTS.has(tagName)) return false;
    if (element.textContent.includes('\n')) return false;
    if (element.querySelector('br')) return false;

    return Array.from(element.childNodes).every((node) => {
        return isInlineSourceNode(node);
    });
}

function canSerializeInlineBlock(element) {
    const tagName = element.tagName.toLowerCase();
    if (!INLINE_SOURCE_ELEMENTS.has(tagName)) return false;

    return Array.from(element.childNodes).every((node) => {
        return isInlineSourceNode(node) || isLineBreakNode(node);
    });
}

function isInlineSourceNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return true;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const tagName = node.tagName.toLowerCase();
    return INLINE_SOURCE_ELEMENTS.has(tagName) && !node.textContent.includes('\n');
}

function isLineBreakNode(node) {
    return node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'br';
}

function serializeInlineSegments(element) {
    const segments = [];
    let currentSegment = '';

    Array.from(element.childNodes).forEach((node) => {
        if (isLineBreakNode(node)) {
            const segment = normalizeInlineSegment(`${currentSegment}<br>`);
            if (segment) segments.push(segment);
            currentSegment = '';
            return;
        }

        currentSegment += serializeInlineNode(node);
    });

    const finalSegment = normalizeInlineSegment(currentSegment);
    if (finalSegment) segments.push(finalSegment);

    return segments;
}

function serializeInlineChildren(element) {
    return Array.from(element.childNodes).map(serializeInlineNode).join('');
}

function serializeInlineNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent.replace(/\s+/g, ' '));
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }

    const tagName = node.tagName.toLowerCase();
    const openingTag = `<${tagName}${formatAttributes(node)}>`;

    if (VOID_ELEMENTS.has(tagName)) {
        return openingTag;
    }

    return `${openingTag}${serializeInlineChildren(node)}</${tagName}>`;
}

function formatAttributes(element) {
    return Array.from(element.attributes)
        .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
        .join('');
}

function normalizeBlockText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function normalizeInlineSegment(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function indent(depth) {
    return INDENT.repeat(depth);
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('"', '&quot;');
}
