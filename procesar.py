#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cúmulo Knowledge Base Generator
=================================
Transforma una colección de documentos (PDF, DOCX, MD, TXT) en una base de
conocimiento estructurada, enriquecida y optimizada para consultas mediante
modelos de lenguaje.

Flujo:
    documentos/  →  docs/kb.json  +  docs/kb-metadata.json

Dependencias:
    - pypdf
    - python-docx

Ejecutar:
    python procesar.py

Autor:  Generado para Cúmulo
Fecha:  2026
"""

import os
import json
import re
import hashlib
import unicodedata
from datetime import datetime
from pathlib import Path
from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional, Tuple, Set

# ---------------------------------------------------------------------------
# DEPENDENCIAS EXTERNAS
# ---------------------------------------------------------------------------
try:
    import pypdf
except ImportError:
    print("❌ Falta pypdf. Ejecuta: pip install pypdf")
    exit(1)

try:
    from docx import Document
except ImportError:
    print("❌ Falta python-docx. Ejecuta: pip install python-docx")
    exit(1)


# ---------------------------------------------------------------------------
# CONSTANTES Y CONFIGURACIÓN
# ---------------------------------------------------------------------------

# Carpetas de entrada y salida
INPUT_DIR = Path("documentos")
OUTPUT_DIR = Path("docs")

# Tamaños y límites
CHUNK_MAX_WORDS = 600          # Palabras máximas por chunk
CHUNK_MAX_CHARS = 4000         # Caracteres máximos por chunk (seguridad)

MESES_ES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
}

# Tipos de documento detectables
DOCUMENT_TYPES = [
    'acta', 'manual', 'reglamento', 'protocolo', 'relatoria',
    'carta', 'cronograma', 'proyecto', 'informe', 'idea', 'formato', 'otro'
]

# Comités detectables
COMMITTEES = [
    'tesoreria', 'astrolectura', 'astroescritura', 'etica', 'charlas',
    'administrativo', 'representacion', 'cumulo nacional', 'cumulo bogota',
    'observatorio', 'universidad', 'general', 'vip', 'inventario',
    'astrochaza', 'viaticos', 'protocolos', 'astronomia',
]

# Alcances detectables
SCOPES = [
    'cumulo bogota', 'cumulo nacional', 'general', 'observatorio',
    'universidad', 'otro',
]

# Estados de documento
STATUSES = ['vigente', 'historico', 'borrador', 'propuesta', 'desconocido']

# Cargos detectables
ROLES = [
    'representante', 'coordinador', 'fundador', 'tesorero', 'relator',
    'moderador', 'asistente', 'presidente', 'vicepresidente', 'secretario',
    'director', 'subdirector', 'miembro', 'invitado', 'ponente',
    'organizador', 'voluntario', 'asesor', 'delegado',
]

# Secciones detectables (en orden de prioridad)
SECTION_HEADERS = [
    'contexto', 'objetivos', 'objetivo', 'asistentes', 'participantes',
    'aprendizajes', 'acuerdos', 'resultados', 'observaciones',
    'tareas realizadas', 'tareas pendientes', 'tareas asignadas',
    'cronograma', 'fechas importantes', 'firmas', 'firma',
    'desarrollo', 'conclusiones', 'recomendaciones', 'anexos',
    'introduccion', 'introducción', 'antecedentes', 'justificacion',
    'justificación', 'metodologia', 'metodología', 'alcance',
    'resumen', 'abstract', 'tabla de contenido', 'contenido',
    'agenda', 'orden del dia', 'orden del día', 'acta',
    'bitacora', 'bitácora', 'notas', 'comentarios',
]

# Palabras vacías (stopwords) en español para keywords
STOPWORDS_ES = {
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las',
    'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'más',
    'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta',
    'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta',
    'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos',
    'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos',
    'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro',
    'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes',
    'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas',
    'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus',
    'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía',
    'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya',
    'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
    'vuestro', 'vuestra', 'vuestros', 'vuestras', 'esos', 'esas', 'estoy',
    'estás', 'está', 'estamos', 'estáis', 'están', 'esté', 'estés',
    'estemos', 'estéis', 'estén', 'estaré', 'estarás', 'estará',
    'estaremos', 'estaréis', 'estarán', 'estaría', 'estarías',
    'estaríamos', 'estaríais', 'estarían', 'estaba', 'estabas',
    'estábamos', 'estabais', 'estaban', 'estuve', 'estuviste', 'estuvo',
    'estuvimos', 'estuvisteis', 'estuvieron', 'estuviera', 'estuvieras',
    'estuviéramos', 'estuvierais', 'estuvieran', 'estuviese', 'estuvieses',
    'estuviésemos', 'estuvieseis', 'estuviesen', 'estando', 'estado',
    'estada', 'estados', 'estadas', 'estad', 'he', 'has', 'ha', 'hemos',
    'habéis', 'han', 'haya', 'hayas', 'hayamos', 'hayáis', 'hayan',
    'habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán',
    'habría', 'habrías', 'habríamos', 'habríais', 'habrían', 'había',
    'habías', 'habíamos', 'habíais', 'habían', 'hube', 'hubiste',
    'hubo', 'hubimos', 'hubisteis', 'hubieron', 'hubiera', 'hubieras',
    'hubiéramos', 'hubierais', 'hubieran', 'hubiese', 'hubieses',
    'hubiésemos', 'hubieseis', 'hubiesen', 'habiendo', 'habido', 'habida',
    'habidos', 'habidas', 'soy', 'eres', 'es', 'somos', 'sois', 'son',
    'sea', 'seas', 'seamos', 'seáis', 'sean', 'seré', 'serás', 'será',
    'seremos', 'seréis', 'serán', 'sería', 'serías', 'seríamos',
    'seríais', 'serían', 'era', 'eras', 'éramos', 'erais', 'eran', 'fui',
    'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron', 'fuera', 'fueras',
    'fuéramos', 'fuerais', 'fueran', 'fuese', 'fueses', 'fuésemos',
    'fueseis', 'fuesen', 'siendo', 'sido', 'tengo', 'tienes', 'tiene',
    'tenemos', 'tenéis', 'tienen', 'tenga', 'tengas', 'tengamos',
    'tengáis', 'tengan', 'tendré', 'tendrás', 'tendrá', 'tendremos',
    'tendréis', 'tendrán', 'tendría', 'tendrías', 'tendríamos',
    'tendríais', 'tendrían', 'tenía', 'tenías', 'teníamos', 'teníais',
    'tenían', 'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis',
    'tuvieron', 'tuviera', 'tuvieras', 'tuviéramos', 'tuvierais',
    'tuvieran', 'tuviese', 'tuvieses', 'tuviésemos', 'tuvieseis',
    'tuviesen', 'teniendo', 'tenido', 'tenida', 'tenidos', 'tenidas',
    'tened',
}


# ---------------------------------------------------------------------------
# FUNCIONES DE EXTRACCIÓN DE TEXTO
# ---------------------------------------------------------------------------

def extract_text_from_pdf(path: Path) -> Tuple[str, int]:
    """
    Extrae texto limpio de un archivo PDF.

    Args:
        path: Ruta al archivo PDF.

    Returns:
        Tupla (texto_extraído, número_de_páginas).
    """
    try:
        reader = pypdf.PdfReader(str(path))
        pages_text = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            pages_text.append(txt)
        text = "\n".join(pages_text).strip()
        return text, len(reader.pages)
    except Exception as e:
        print(f"  ⚠️  Error leyendo PDF {path}: {e}")
        return "", 0


def extract_text_from_docx(path: Path) -> Tuple[str, int]:
    """
    Extrae texto de un archivo DOCX.

    Args:
        path: Ruta al archivo DOCX.

    Returns:
        Tupla (texto_extraído, número_de_páginas_estimado).
    """
    try:
        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs).strip()
        # Estimacion burda de paginas: ~3000 chars por pagina
        estimated_pages = max(1, len(text) // 3000)
        return text, estimated_pages
    except Exception as e:
        print(f"  ⚠️  Error leyendo DOCX {path}: {e}")
        return "", 0


def extract_text_from_plain(path: Path) -> Tuple[str, int]:
    """
    Lee un archivo de texto plano (Markdown o TXT).

    Args:
        path: Ruta al archivo.

    Returns:
        Tupla (texto_extraído, número_de_páginas_estimado).
    """
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        estimated_pages = max(1, len(text) // 3000)
        return text, estimated_pages
    except Exception as e:
        print(f"  ⚠️  Error leyendo {path}: {e}")
        return "", 0


def extract_text(path: Path) -> Tuple[str, int]:
    """
    Dispatcher de extraccion de texto segun extension del archivo.

    Args:
        path: Ruta al archivo.

    Returns:
        Tupla (texto_extraído, número_de_páginas).
    """
    suffix = path.suffix.lower()
    if suffix == '.pdf':
        return extract_text_from_pdf(path)
    elif suffix in ('.docx', '.doc'):
        return extract_text_from_docx(path)
    elif suffix in ('.md', '.txt'):
        return extract_text_from_plain(path)
    else:
        return "", 0


# ---------------------------------------------------------------------------
# FUNCIONES DE LIMPIEZA DE TEXTO
# ---------------------------------------------------------------------------

def normalize_newlines(text: str) -> str:
    """Normaliza todos los saltos de linea a \\n."""
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Eliminar saltos de linea multiples excesivos, mantener parrafos
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def fix_ocr_errors(text: str) -> str:
    """Corrige errores comunes de OCR y caracteres especiales."""
    # fi ligature
    text = text.replace('\ufb01', 'fi')
    # fl ligature
    text = text.replace('\ufb02', 'fl')
    # ffi ligature
    text = text.replace('\ufb03', 'ffi')
    # ffl ligature
    text = text.replace('\ufb04', 'ffl')
    # ff ligature
    text = text.replace('\ufb00', 'ff')
    # Palabra partida al final de linea (ej: "palabra-\nabra")
    text = re.sub(r'([a-zA-Z])-\n([a-zA-Z])', r'\1\2', text)
    text = re.sub(r'([a-zA-Z])-\r\n?([a-zA-Z])', r'\1\2', text)
    return text


def remove_invisible_chars(text: str) -> str:
    """Elimina caracteres de control e invisibles, preservando acentos."""
    # Preservar tabulaciones (\\t) y saltos de linea (\\n)
    allowed = set('\t\n')
    cleaned = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith('C') and ch not in allowed:
            continue
        cleaned.append(ch)
    return ''.join(cleaned)


def collapse_spaces(text: str) -> str:
    """Colapsa espacios multiples en uno solo, preservando indentacion de listas."""
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Preservar espacios iniciales para listas
        stripped = line.lstrip()
        leading = line[:len(line) - len(stripped)]
        # Colapsar espacios internos
        stripped = re.sub(r'\s+', ' ', stripped)
        cleaned_lines.append(leading + stripped)
    return '\n'.join(cleaned_lines)


def clean_text(text: str) -> str:
    """
    Pipeline completo de limpieza de texto.

    Orden:
        1. Normalizar saltos de linea
        2. Corregir OCR
        3. Eliminar caracteres invisibles
        4. Colapsar espacios
    """
    text = normalize_newlines(text)
    text = fix_ocr_errors(text)
    text = remove_invisible_chars(text)
    text = collapse_spaces(text)
    return text.strip()


# ---------------------------------------------------------------------------
# FUNCIONES DE DETECCION DE METADATOS
# ---------------------------------------------------------------------------

def detect_document_type(text: str, filename: str) -> str:
    """
    Detecta el tipo de documento basado en contenido y nombre de archivo.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Tipo de documento en minusculas.
    """
    combined = (filename + " " + text[:2000]).lower()

    # Palabras clave por tipo (ordenados por prioridad)
    type_keywords = {
        'acta': ['acta', 'asistentes', 'orden del dia', 'orden del día', 'acuerdos'],
        'relatoria': ['relatoria', 'relator', 'moderador', 'sesion', 'sesión'],
        'manual': ['manual', 'procedimiento', 'instrucciones', 'guia de uso', 'guía de uso'],
        'reglamento': ['reglamento', 'normativa', 'disposiciones', 'articulo', 'artículo'],
        'protocolo': ['protocolo', 'procedimiento estandar', 'estandar de'],
        'carta': ['carta', 'oficio', 'memorando', 'comunicado', 'remitente', 'destinatario'],
        'cronograma': ['cronograma', 'calendario', 'timeline', 'fechas clave', 'hitos'],
        'proyecto': ['proyecto', 'propuesta', 'plan de trabajo', 'plan de accion'],
        'informe': ['informe', 'reporte', 'report', 'analisis', 'análisis', 'estadisticas'],
        'idea': ['idea', 'brainstorm', 'lluvia de ideas', 'concepto inicial'],
        'formato': ['formato', 'formulario', 'plantilla', 'template', 'campos a llenar'],
    }

    scores = {}
    for doc_type, keywords in type_keywords.items():
        score = sum(2 if kw in combined else 0 for kw in keywords)
        scores[doc_type] = score

    # Bonus por nombre de archivo
    fname_lower = filename.lower()
    for doc_type in type_keywords:
        if doc_type in fname_lower:
            scores[doc_type] = scores.get(doc_type, 0) + 5

    best = max(scores, key=scores.get, default='otro')
    if scores.get(best, 0) == 0:
        return 'otro'
    return best


def detect_committee(text: str, filename: str) -> str:
    """
    Detecta el comite al que pertenece el documento.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Nombre del comite normalizado.
    """
    combined = (filename + " " + text[:3000]).lower()

    # Mapeo de variantes a nombre canonico
    committee_map = {
        'tesoreria': ['tesoreria', 'tesorero', 'presupuesto', 'finanzas', 'viaticos', 'viáticos'],
        'astrolectura': ['astrolectura', 'lectura', 'libro', 'libros'],
        'astroescritura': ['astroescritura', 'escritura', 'redaccion', 'redacción', 'editorial'],
        'etica': ['etica', 'ética', 'codigo de conducta', 'código de conducta', 'comite etico'],
        'charlas': ['charlas', 'conferencia', 'conferencias', 'ponente', 'expositor', 'talk'],
        'administrativo': ['administrativo', 'administracion', 'administración', 'logistica', 'logística'],
        'representacion': ['representacion', 'representación', 'delegado', 'delegados', 'embajador'],
        'cumulo nacional': ['cumulo nacional', 'nacional', 'pais', 'país'],
        'cumulo bogota': ['cumulo bogota', 'cumulo bogotá', 'bogota', 'bogotá', 'local'],
        'observatorio': ['observatorio', 'telescopio', 'observacion', 'observación', 'astronomico'],
        'universidad': ['universidad', 'academico', 'académico', 'facultad', 'carrera'],
        'vip': ['vip', 'invitado especial', 'distinguido'],
        'inventario': ['inventario', 'equipo', 'materiales', 'suministros'],
        'astrochaza': ['astrochaza', 'chaza', 'mercado', 'venta', 'compra'],
        'protocolos': ['protocolo', 'protocolos', 'procedimiento'],
        'astronomia': ['astronomia', 'astronomía', 'astrofotografia', 'astrofotografía'],
    }

    scores = {}
    for committee, keywords in committee_map.items():
        score = sum(2 if kw in combined else 0 for kw in keywords)
        scores[committee] = score

    # Bonus por nombre de archivo
    for committee in committee_map:
        if committee.replace(' ', '') in filename.lower().replace(' ', ''):
            scores[committee] = scores.get(committee, 0) + 5

    best = max(scores, key=scores.get, default='general')
    if scores.get(best, 0) == 0:
        return 'general'
    return best


def detect_scope(text: str, filename: str) -> str:
    """
    Detecta el alcance geografico o institucional del documento.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Alcance detectado.
    """
    combined = (filename + " " + text[:2000]).lower()

    scope_map = {
        'cumulo bogota': ['bogota', 'bogotá', 'local', 'sede bogota', 'sede bogotá'],
        'cumulo nacional': ['nacional', 'todo el pais', 'todo el país', 'colombia'],
        'observatorio': ['observatorio', 'observacion', 'observación'],
        'universidad': ['universidad', 'facultad', 'carrera', 'academico', 'académico'],
    }

    for scope, keywords in scope_map.items():
        if any(kw in combined for kw in keywords):
            return scope

    return 'general'


def detect_semester(text: str, filename: str) -> Optional[str]:
    """
    Detecta el semestre academico al que pertenece el documento.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Semestre en formato YYYY-N o None.
    """
    combined = filename + " " + text[:1500]

    # Patron explicito: 2025-1, 2025-2, 2026-1, etc.
    match = re.search(r'\b(\d{4})[-\s]?(1|2)\b', combined)
    if match:
        year, sem = match.groups()
        return f"{year}-{sem}"

    # Inferir desde fechas
    dates = extract_dates(text, filename)
    if dates and dates.get('all'):
        first_date = dates['all'][0]
        try:
            dt = datetime.strptime(first_date, '%Y-%m-%d')
            year = dt.year
            semester = 1 if dt.month <= 6 else 2
            return f"{year}-{semester}"
        except ValueError:
            pass

    return None


def detect_status(text: str, filename: str) -> str:
    """
    Detecta el estado del documento.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Estado del documento.
    """
    combined = (filename + " " + text[:2000]).lower()

    if any(kw in combined for kw in ['borrador', 'draft', 'preliminar', 'preliminary']):
        return 'borrador'
    if any(kw in combined for kw in ['propuesta', 'proposed', 'propuesto']):
        return 'propuesta'
    if any(kw in combined for kw in ['historico', 'histórico', 'archivado', 'archived', 'pasado']):
        return 'historico'
    if any(kw in combined for kw in ['vigente', 'actual', 'current', 'en uso', 'aprobado']):
        return 'vigente'

    return 'desconocido'


# ---------------------------------------------------------------------------
# FUNCIONES DE EXTRACCION DE FECHAS
# ---------------------------------------------------------------------------

def _parse_month(month_str: str) -> Optional[int]:
    """Convierte nombre de mes a numero."""
    month_str = month_str.lower().strip()
    return MESES_ES.get(month_str)


def _normalize_date(year: int, month: int, day: int) -> Optional[str]:
    """Valida y normaliza una fecha a ISO."""
    try:
        dt = datetime(year, month, day)
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        return None


def extract_dates(text: str, filename: str) -> Optional[Dict[str, Any]]:
    """
    Extrae todas las fechas del texto y nombre de archivo.

    Args:
        text: Contenido del documento.
        filename: Nombre del archivo.

    Returns:
        Diccionario con start, end, all (lista) o None si no hay fechas.
    """
    combined = filename + " " + text[:3000]
    found_dates: Set[str] = set()

    # Patron ISO: 2025-08-15
    for m in re.finditer(r'\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b', combined):
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        d = _normalize_date(year, month, day)
        if d:
            found_dates.add(d)

    # Patron espanol corto: 15/08/2025
    for m in re.finditer(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', combined):
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        d = _normalize_date(year, month, day)
        if d:
            found_dates.add(d)

    # Patron espanol largo: 15 de agosto de 2025
    pattern_long = r'\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de(?:l)?\s+(\d{4})\b'
    for m in re.finditer(pattern_long, combined, re.IGNORECASE):
        day = int(m.group(1))
        month = _parse_month(m.group(2))
        year = int(m.group(3))
        if month:
            d = _normalize_date(year, month, day)
            if d:
                found_dates.add(d)

    # Rangos: 27-29 de enero de 2026
    pattern_range = r'\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de(?:l)?\s+(\d{4})\b'
    for m in re.finditer(pattern_range, combined, re.IGNORECASE):
        start_day = int(m.group(1))
        end_day = int(m.group(2))
        month = _parse_month(m.group(3))
        year = int(m.group(4))
        if month:
            for day in range(start_day, end_day + 1):
                d = _normalize_date(year, month, day)
                if d:
                    found_dates.add(d)

    # Multiples: 12, 13 y 15 de agosto de 2025
    pattern_multi = r'\b(\d{1,2})(?:,\s+(\d{1,2}))(?:\s+y\s+(\d{1,2}))?\s+de\s+([a-záéíóúñ]+)\s+de(?:l)?\s+(\d{4})\b'
    for m in re.finditer(pattern_multi, combined, re.IGNORECASE):
        days = [int(m.group(1))]
        if m.group(2):
            days.append(int(m.group(2)))
        if m.group(3):
            days.append(int(m.group(3)))
        month = _parse_month(m.group(4))
        year = int(m.group(5))
        if month:
            for day in days:
                d = _normalize_date(year, month, day)
                if d:
                    found_dates.add(d)

    if not found_dates:
        return None

    sorted_dates = sorted(found_dates)
    return {
        'start': sorted_dates[0],
        'end': sorted_dates[-1],
        'all': sorted_dates,
    }


# ---------------------------------------------------------------------------
# FUNCIONES DE EXTRACCION DE PERSONAS Y FIRMANTES
# ---------------------------------------------------------------------------

def extract_people(text: str) -> List[Dict[str, str]]:
    """
    Extrae nombres de personas y sus posibles cargos.

    Heuristica:
        - Busca lineas que contengan palabras de cargo.
        - Extrae nombres propios (2-4 palabras capitalizadas).

    Args:
        text: Contenido del documento.

    Returns:
        Lista de diccionarios {name, role}.
    """
    people = []
    seen = set()

    # Lineas que contienen un cargo
    lines = text.split('\n')
    for line in lines:
        line_lower = line.lower()
        if not any(role in line_lower for role in ROLES):
            continue

        # Extraer nombres propios (2-4 palabras capitalizadas consecutivas)
        name_matches = re.findall(
            r'\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})\b',
            line
        )

        for name in name_matches:
            name = name.strip()
            if len(name) < 5:  # Filtrar muy cortos
                continue
            # Detectar cargo en la linea
            detected_role = 'asistente'
            for role in ROLES:
                if role in line_lower:
                    detected_role = role
                    break

            key = f"{name.lower()}|{detected_role}"
            if key not in seen:
                seen.add(key)
                people.append({'name': name, 'role': detected_role})

    return people


def extract_signatures(text: str) -> List[Dict[str, str]]:
    """
    Extrae firmas del documento.

    Heuristica:
        - Busca secciones de firma.
        - Extrae nombres y cargos cercanos a palabras como "firma", "firmado".

    Args:
        text: Contenido del documento.

    Returns:
        Lista de diccionarios {name, role}.
    """
    signatures = []
    seen = set()

    # Buscar bloques de firma
    signature_blocks = re.split(
        r'(?:firma[s]?|firmado[s]?|firmantes|firmado por)[:\s]*',
        text,
        flags=re.IGNORECASE
    )

    for block in signature_blocks[1:]:  # Saltar el primer bloque (antes de "firma")
        block_text = block[:500]  # Solo las primeras 500 chars despues de "firma"
        lines = block_text.split('\n')[:10]

        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue

            # Extraer nombres propios
            name_matches = re.findall(
                r'\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})\b',
                line
            )

            for name in name_matches:
                name = name.strip()
                if len(name) < 5:
                    continue

                # Detectar cargo
                detected_role = 'firmante'
                line_lower = line.lower()
                for role in ROLES:
                    if role in line_lower:
                        detected_role = role
                        break

                key = f"{name.lower()}|{detected_role}"
                if key not in seen:
                    seen.add(key)
                    signatures.append({'name': name, 'role': detected_role})

    return signatures


# ---------------------------------------------------------------------------
# FUNCIONES DE EXTRACCION DE SECCIONES
# ---------------------------------------------------------------------------

def extract_sections(text: str) -> Dict[str, str]:
    """
    Separa el documento en secciones identificadas por encabezados.

    Args:
        text: Contenido del documento.

    Returns:
        Diccionario {nombre_seccion: contenido}.
    """
    sections = {}

    # Construir patron de encabezados
    header_pattern = '|'.join(re.escape(h) for h in SECTION_HEADERS)
    # Encabezados pueden estar en mayusculas, con :, ., o en negrita
    regex = re.compile(
        rf'(?:^|\n)\s*(?:#{{1,4}}\s*)?\b({header_pattern})\b[:\.\s]*(?:\n|$)',
        re.IGNORECASE
    )

    # Encontrar todos los encabezados y sus posiciones
    matches = list(regex.finditer(text))

    if not matches:
        # Si no hay secciones, todo va a 'contenido'
        sections['contenido'] = text.strip()
        return sections

    # Extraer contenido entre encabezados
    for i, match in enumerate(matches):
        header = match.group(1).lower().strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if content:
            sections[header] = content

    # Si hay texto antes del primer encabezado, va a 'contexto'
    if matches[0].start() > 0:
        preamble = text[:matches[0].start()].strip()
        if preamble:
            sections['contexto'] = preamble

    return sections


# ---------------------------------------------------------------------------
# FUNCIONES DE GENERACION DE RESUMEN Y PALABRAS CLAVE
# ---------------------------------------------------------------------------

def generate_summary(text: str, sections: Dict[str, str]) -> str:
    """
    Genera un resumen automatico sin usar IA.

    Estrategia:
        1. Usar primer parrafo si es informativo (>100 chars).
        2. Combinar con contenido de secciones 'contexto', 'objetivos'.
        3. Limitar a ~300 palabras.

    Args:
        text: Texto completo del documento.
        sections: Secciones extraidas.

    Returns:
        Resumen breve.
    """
    parts = []

    # Primer parrafo
    first_para = text.split('\n\n')[0].strip() if text else ""
    if len(first_para) > 50:
        parts.append(first_para)

    # Contexto
    if 'contexto' in sections and sections['contexto']:
        parts.append(sections['contexto'][:500])

    # Objetivos
    if 'objetivos' in sections and sections['objetivos']:
        parts.append("Objetivos: " + sections['objetivos'][:500])

    # Objetivo (singular)
    if 'objetivo' in sections and sections['objetivo']:
        parts.append("Objetivo: " + sections['objetivo'][:500])

    summary = " ".join(parts)

    # Limitar a ~300 palabras
    words = summary.split()
    if len(words) > 300:
        summary = " ".join(words[:300]) + "..."

    return summary.strip()


def generate_keywords(text: str) -> List[str]:
    """
    Genera palabras clave eliminando stopwords.

    Args:
        text: Contenido del documento.

    Returns:
        Lista de palabras clave ordenadas por frecuencia.
    """
    # Extraer palabras (minimo 3 caracteres, solo letras)
    words = re.findall(r'\b[a-záéíóúñ]{3,}\b', text.lower())

    # Filtrar stopwords
    filtered = [w for w in words if w not in STOPWORDS_ES]

    # Contar frecuencias
    counter = Counter(filtered)

    # Devolver top 20
    keywords = [word for word, count in counter.most_common(20)]
    return keywords


# ---------------------------------------------------------------------------
# FUNCIONES DE CHUNKING INTELIGENTE
# ---------------------------------------------------------------------------

def smart_chunk(text: str, sections: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Divide el texto en chunks inteligentes respetando secciones y estructura.

    Reglas:
        - Preferir dividir por secciones.
        - No cortar listas, tareas, tablas, firmas.
        - Solo subdividir secciones muy largas.

    Args:
        text: Texto completo del documento.
        sections: Secciones extraidas.

    Returns:
        Lista de chunks con metadata.
    """
    chunks = []
    chunk_id = 0

    for section_name, section_text in sections.items():
        if not section_text.strip():
            continue

        words = section_text.split()

        if len(words) <= CHUNK_MAX_WORDS:
            # La seccion cabe en un solo chunk
            chunks.append({
                'id': f"chunk_{chunk_id:05d}",
                'section': section_name,
                'text': section_text.strip(),
                'tokens': len(words),
                'chars': len(section_text),
            })
            chunk_id += 1
        else:
            # Subdividir la seccion respetando parrafos
            paragraphs = section_text.split('\n\n')
            current_chunk = []
            current_words = 0

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue

                para_words = len(para.split())

                # Si agregar este parrafo excede el limite y ya hay contenido
                if current_words + para_words > CHUNK_MAX_WORDS and current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append({
                        'id': f"chunk_{chunk_id:05d}",
                        'section': section_name,
                        'text': chunk_text.strip(),
                        'tokens': current_words,
                        'chars': len(chunk_text),
                    })
                    chunk_id += 1
                    current_chunk = [para]
                    current_words = para_words
                else:
                    current_chunk.append(para)
                    current_words += para_words

            # Agregar lo que queda
            if current_chunk:
                chunk_text = '\n\n'.join(current_chunk)
                chunks.append({
                    'id': f"chunk_{chunk_id:05d}",
                    'section': section_name,
                    'text': chunk_text.strip(),
                    'tokens': current_words,
                    'chars': len(chunk_text),
                })
                chunk_id += 1

    return chunks


# ---------------------------------------------------------------------------
# FUNCIONES DE CONTEO Y ESTADISTICAS
# ---------------------------------------------------------------------------

def count_attendees(people: List[Dict[str, str]]) -> int:
    """Cuenta el numero de asistentes/participantes."""
    return len(people)


def count_agreements(text: str) -> int:
    """Cuenta acuerdos mencionados en el texto."""
    patterns = [
        r'\bacuerdo[s]?\b',
        r'\bse acord[oó]\b',
        r'\bqued[oó] establecido\b',
        r'\bresoluci[oó]n\b',
    ]
    count = 0
    for pattern in patterns:
        count += len(re.findall(pattern, text, re.IGNORECASE))
    return count


def count_tasks(text: str) -> int:
    """Cuenta tareas mencionadas en el texto."""
    patterns = [
        r'\btarea[s]?\b',
        r'\bpending[s]?\b',
        r'\basignar\b',
        r'\basignado\b',
        r'\bresponsable\b',
        r'\bentrega\b',
        r'\bplazo\b',
    ]
    count = 0
    for pattern in patterns:
        count += len(re.findall(pattern, text, re.IGNORECASE))
    return count


def count_signatures(signatures: List[Dict[str, str]]) -> int:
    """Cuenta firmas extraidas."""
    return len(signatures)


def compute_file_hash(path: Path) -> str:
    """Calcula SHA-256 del archivo."""
    sha256 = hashlib.sha256()
    try:
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception as e:
        print(f"  ⚠️  Error calculando hash de {path}: {e}")
        return ""


def build_stats(text: str, people: List[Dict], signatures: List[Dict],
                chunks: List[Dict], pages: int) -> Dict[str, Any]:
    """
    Construye el bloque de estadisticas del documento.

    Args:
        text: Texto completo.
        people: Lista de participantes.
        signatures: Lista de firmas.
        chunks: Lista de chunks.
        pages: Numero de paginas.

    Returns:
        Diccionario de estadisticas.
    """
    words = len(text.split())
    chars = len(text)

    return {
        'pages': pages,
        'words': words,
        'characters': chars,
        'attendees': count_attendees(people),
        'agreements': count_agreements(text),
        'tasks': count_tasks(text),
        'signatures': count_signatures(signatures),
        'chunks': len(chunks),
    }


# ---------------------------------------------------------------------------
# FUNCIONES DE CONSTRUCCION DE DOCUMENTO
# ---------------------------------------------------------------------------

def generate_document_id(doc_type: str, committee: str, dates: Optional[Dict],
                         filename: str, index: int) -> str:
    """
    Genera un identificador unico permanente para el documento.

    Formato: TIPO-COMITE-AAAA-NNN

    Args:
        doc_type: Tipo de documento.
        committee: Comite.
        dates: Fechas extraidas.
        filename: Nombre original.
        index: Indice numerico para unicidad.

    Returns:
        Identificador del documento.
    """
    type_abbr = doc_type.upper()[:4]
    comm_abbr = committee.upper().replace(' ', '')[:6]

    year = "0000"
    if dates and dates.get('start'):
        year = dates['start'][:4]
    else:
        # Intentar extraer anio del filename
        m = re.search(r'\b(\d{4})\b', filename)
        if m:
            year = m.group(1)

    return f"{type_abbr}-{comm_abbr}-{year}-{index:03d}"


def build_document(path: Path, index: int) -> Optional[Dict[str, Any]]:
    """
    Construye el objeto documento completo a partir de un archivo.

    Args:
        path: Ruta al archivo.
        index: Indice para generar ID unico.

    Returns:
        Diccionario del documento o None si falla.
    """
    print(f"  📄 {path.name}", end=" ... ")

    # 1. Extraer texto
    text, pages = extract_text(path)
    if not text:
        print("⚠️  (vacio)")
        return None

    # 2. Limpiar texto
    text = clean_text(text)

    # 3. Detectar metadatos
    doc_type = detect_document_type(text, path.name)
    committee = detect_committee(text, path.name)
    scope = detect_scope(text, path.name)
    semester = detect_semester(text, path.name)
    status = detect_status(text, path.name)
    dates = extract_dates(text, path.name)

    # 4. Extraer personas y firmas
    people = extract_people(text)
    signatures = extract_signatures(text)

    # 5. Extraer secciones
    sections = extract_sections(text)

    # 6. Generar resumen y keywords
    summary = generate_summary(text, sections)
    keywords = generate_keywords(text)

    # 7. Chunks inteligentes
    chunks = smart_chunk(text, sections)

    # 8. Estadisticas
    stats = build_stats(text, people, signatures, chunks, pages)

    # 9. Hash del archivo
    file_hash = compute_file_hash(path)

    # 10. Informacion del archivo
    file_info = {
        'name': path.name,
        'path': str(path),
        'extension': path.suffix.lower().lstrip('.'),
        'size_bytes': path.stat().st_size,
        'modified_at': datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
        'extracted_at': datetime.now().isoformat(),
        'hash_sha256': file_hash,
    }

    # 11. Generar ID
    doc_id = generate_document_id(doc_type, committee, dates, path.name, index)

    # 12. Asignar IDs de documento a chunks
    for chunk in chunks:
        chunk['document_id'] = doc_id

    # 13. Relaciones (inicialmente vacias, se llenan en post-proceso)
    relations = {
        'same_committee': [],
        'consecutive': [],
        'versions': [],
    }

    # 14. Version (inferida del nombre)
    version = "1.0"
    v_match = re.search(r'v(\d+(?:\.\d+)?)', path.name, re.IGNORECASE)
    if v_match:
        version = v_match.group(1)

    print(f"✓ {doc_id} ({stats['words']} palabras, {len(chunks)} chunks)")

    return {
        'document_id': doc_id,
        'document_type': doc_type,
        'committee': committee,
        'scope': scope,
        'semester': semester,
        'status': status,
        'version': version,
        'dates': dates,
        'participants': people,
        'signatures': signatures,
        'summary': summary,
        'keywords': keywords,
        'sections': sections,
        'chunks': chunks,
        'stats': stats,
        'file': file_info,
        'relations': relations,
    }


# ---------------------------------------------------------------------------
# FUNCIONES DE RELACIONES ENTRE DOCUMENTOS
# ---------------------------------------------------------------------------

def build_relations(documents: List[Dict[str, Any]]) -> None:
    """
    Detecta y establece relaciones entre documentos.

    Relaciones:
        - same_committee: documentos del mismo comite.
        - consecutive: actas con IDs consecutivos.
        - versions: documentos con mismo tipo+comite+anio pero diferente version.

    Args:
        documents: Lista de documentos (modificada in-place).
    """
    # Indice por comite
    by_committee = defaultdict(list)
    for doc in documents:
        by_committee[doc['committee']].append(doc['document_id'])

    # Indice por tipo+comite+anio
    by_group = defaultdict(list)
    for doc in documents:
        key = f"{doc['document_type']}-{doc['committee']}"
        if doc['dates'] and doc['dates'].get('start'):
            key += f"-{doc['dates']['start'][:4]}"
        by_group[key].append(doc)

    for doc in documents:
        doc_id = doc['document_id']

        # Mismo comite
        same = [d for d in by_committee[doc['committee']] if d != doc_id]
        doc['relations']['same_committee'] = same[:10]  # Limitar a 10

        # Consecutivos (mismo prefijo, numero +1 o -1)
        prefix = '-'.join(doc_id.split('-')[:-1])
        try:
            num = int(doc_id.split('-')[-1])
            for other in documents:
                if other['document_id'] == doc_id:
                    continue
                other_prefix = '-'.join(other['document_id'].split('-')[:-1])
                try:
                    other_num = int(other['document_id'].split('-')[-1])
                    if other_prefix == prefix and abs(other_num - num) == 1:
                        doc['relations']['consecutive'].append(other['document_id'])
                except ValueError:
                    continue
        except ValueError:
            pass

        # Versiones
        group_key = f"{doc['document_type']}-{doc['committee']}"
        if doc['dates'] and doc['dates'].get('start'):
            group_key += f"-{doc['dates']['start'][:4]}"
        versions = [d['document_id'] for d in by_group[group_key] if d['document_id'] != doc_id]
        doc['relations']['versions'] = versions[:5]


# ---------------------------------------------------------------------------
# FUNCIONES DE CONSTRUCCION DE METADATA GLOBAL
# ---------------------------------------------------------------------------

def build_metadata(documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Construye el indice global de metadatos (kb-metadata.json).

    Args:
        documents: Lista de todos los documentos procesados.

    Returns:
        Diccionario de metadata global.
    """
    # Conteos por tipo
    type_counts = Counter(d['document_type'] for d in documents)

    # Conteos por comite
    committee_counts = Counter(d['committee'] for d in documents)

    # Conteos por anio
    year_counts = Counter()
    for d in documents:
        if d['dates'] and d['dates'].get('start'):
            year_counts[d['dates']['start'][:4]] += 1

    # Conteos por semestre
    semester_counts = Counter()
    for d in documents:
        if d['semester']:
            semester_counts[d['semester']] += 1

    # Conteos por estado
    status_counts = Counter(d['status'] for d in documents)

    # Conteos por carpeta
    folder_counts = Counter()
    for d in documents:
        folder = d['file']['path'].split(os.sep)[1] if os.sep in d['file']['path'] else 'root'
        folder_counts[folder] += 1

    # Personas detectadas (unicas)
    all_people = set()
    for d in documents:
        for p in d['participants']:
            all_people.add(p['name'])

    # Firmantes (unicos)
    all_signers = set()
    for d in documents:
        for s in d['signatures']:
            all_signers.add(s['name'])

    # Fechas minima y maxima
    all_dates = []
    for d in documents:
        if d['dates'] and d['dates'].get('all'):
            all_dates.extend(d['dates']['all'])

    date_range = {
        'earliest': min(all_dates) if all_dates else None,
        'latest': max(all_dates) if all_dates else None,
    }

    docs_without_date = sum(1 for d in documents if d['dates'] is None)

    # Palabras clave mas frecuentes
    all_keywords = []
    for d in documents:
        all_keywords.extend(d['keywords'])
    top_keywords = [kw for kw, _ in Counter(all_keywords).most_common(30)]

    # Documentos con mas tareas
    docs_by_tasks = sorted(
        documents,
        key=lambda d: d['stats']['tasks'],
        reverse=True
    )[:10]
    top_task_docs = [d['document_id'] for d in docs_by_tasks]

    # Total de chunks
    total_chunks = sum(d['stats']['chunks'] for d in documents)
    total_tokens = sum(
        sum(c['tokens'] for c in d['chunks'])
        for d in documents
    )

    return {
        'generated_at': datetime.now().isoformat(),
        'total_documents': len(documents),
        'total_chunks': total_chunks,
        'total_tokens': total_tokens,
        'counts': {
            'by_type': dict(type_counts),
            'by_committee': dict(committee_counts),
            'by_year': dict(year_counts),
            'by_semester': dict(semester_counts),
            'by_status': dict(status_counts),
            'by_folder': dict(folder_counts),
        },
        'people': {
            'all_detected': sorted(all_people),
            'count': len(all_people),
            'signers': sorted(all_signers),
            'signers_count': len(all_signers),
        },
        'dates': {
            'range': date_range,
            'without_date': docs_without_date,
        },
        'keywords': {
            'top_30': top_keywords,
        },
        'rankings': {
            'most_tasks': top_task_docs,
        },
        'documents': [d['document_id'] for d in documents],
    }


# ---------------------------------------------------------------------------
# FUNCIONES DE EXPORTACION
# ---------------------------------------------------------------------------

def export_json(documents: List[Dict[str, Any]], metadata: Dict[str, Any]) -> None:
    """
    Exporta los archivos JSON finales.

    Args:
        documents: Lista de documentos procesados.
        metadata: Metadata global.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # kb.json
    kb_path = OUTPUT_DIR / "kb.json"
    with open(kb_path, 'w', encoding='utf-8') as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    kb_size = kb_path.stat().st_size / 1024

    # kb-metadata.json
    meta_path = OUTPUT_DIR / "kb-metadata.json"
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    meta_size = meta_path.stat().st_size / 1024

    print(f"\n  💾 kb.json          → {kb_path} ({kb_size:.1f} KB)")
    print(f"  💾 kb-metadata.json → {meta_path} ({meta_size:.1f} KB)")


# ---------------------------------------------------------------------------
# FUNCION PRINCIPAL
# ---------------------------------------------------------------------------

def main() -> None:
    """Punto de entrada principal del generador de base de conocimiento."""
    print("=" * 70)
    print("🔨  Cúmulo Knowledge Base Generator")
    print("=" * 70)

    if not INPUT_DIR.exists():
        print(f"\n❌ No se encontro la carpeta '{INPUT_DIR}' en {Path.cwd()}")
        print("   Crea una carpeta llamada 'documentos' con tus archivos.")
        exit(1)

    # Recolectar archivos soportados
    supported_exts = {'.pdf', '.docx', '.doc', '.md', '.txt'}
    files = sorted([
        p for p in INPUT_DIR.rglob('*')
        if p.is_file() and p.suffix.lower() in supported_exts and not p.name.startswith('.')
    ])

    if not files:
        print(f"\n❌ No se encontraron documentos en '{INPUT_DIR}'")
        exit(1)

    print(f"\n📂 {len(files)} documentos encontrados. Procesando...\n")

    documents = []
    for idx, path in enumerate(files, start=1):
        doc = build_document(path, idx)
        if doc:
            documents.append(doc)

    if not documents:
        print("\n❌ No se pudo procesar ningun documento.")
        exit(1)

    print(f"\n✅ {len(documents)} documentos procesados exitosamente.")

    # Construir relaciones entre documentos
    print("\n🔗 Analizando relaciones entre documentos...")
    build_relations(documents)

    # Construir metadata global
    print("📊 Generando indice global...")
    metadata = build_metadata(documents)

    # Exportar
    print("\n💾 Exportando archivos JSON...")
    export_json(documents, metadata)

    # Resumen final
    print("\n" + "=" * 70)
    print("📋 RESUMEN FINAL")
    print("=" * 70)
    print(f"  Documentos procesados: {metadata['total_documents']}")
    print(f"  Chunks generados:      {metadata['total_chunks']}")
    print(f"  Tokens totales:        {metadata['total_tokens']:,}")
    print(f"  Personas detectadas:   {metadata['people']['count']}")
    print(f"  Firmantes:             {metadata['people']['signers_count']}")
    print(f"  Rango de fechas:       {metadata['dates']['range']['earliest']} → {metadata['dates']['range']['latest']}")
    print(f"  Sin fecha:             {metadata['dates']['without_date']}")
    print("\n  Por tipo:")
    for doc_type, count in metadata['counts']['by_type'].items():
        print(f"    • {doc_type}: {count}")
    print("\n  Por comite:")
    for committee, count in metadata['counts']['by_committee'].items():
        print(f"    • {committee}: {count}")
    print("\n" + "=" * 70)
    print("🚀 Proximos pasos:")
    print("   1. Sube docs/kb.json y docs/kb-metadata.json a GitHub")
    print("   2. Activa GitHub Pages: Settings → Pages → /docs folder")
    print("   3. Tu KB estara en: https://tu-usuario.github.io/cumulo")
    print("=" * 70)


if __name__ == "__main__":
    main()
