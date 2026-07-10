#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Procesa documentos de Cúmulo y genera kb.json para GitHub Pages
Ejecutar: python procesar.py
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path

# Intenta importar librerías; si faltan, da instrucciones
try:
    import pypdf
except ImportError:
    print("❌ Falta pypdf. Ejecuta:")
    print("   pip install pypdf")
    exit(1)

try:
    from docx import Document
except ImportError:
    print("❌ Falta python-docx. Ejecuta:")
    print("   pip install python-docx")
    exit(1)


def extract_text_from_pdf(path):
    """Extrae texto limpio de un PDF"""
    try:
        reader = pypdf.PdfReader(path)
        text = "\n".join([page.extract_text() or "" for page in reader.pages])
        return text.strip()
    except Exception as e:
        print(f"  ⚠️  Error leyendo {path}: {e}")
        return ""


def extract_text_from_docx(path):
    """Extrae texto de un Word"""
    try:
        doc = Document(path)
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return text.strip()
    except Exception as e:
        print(f"  ⚠️  Error leyendo {path}: {e}")
        return ""


def extract_text_from_markdown(path):
    """Lee un archivo Markdown"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"  ⚠️  Error leyendo {path}: {e}")
        return ""


def extract_date_from_text(text, filename):
    """Intenta extraer una fecha del texto o nombre del archivo"""
    # Buscar patrón YYYY-MM-DD
    match = re.search(r'(\d{4})-(\d{2})-(\d{2})', filename + " " + text[:500])
    if match:
        return match.group(1) + "-" + match.group(2) + "-" + match.group(3)
    
    # Buscar patrón DD/MM/YYYY o similar
    match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', filename + " " + text[:500])
    if match:
        day, month, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    return "sin_fecha"


def chunk_text(text, chunk_size=600):
    """Divide texto en chunks coherentes (por párrafos/secciones)"""
    if not text or not text.strip():
        return []
    
    # Dividir por párrafos dobles (cambio de línea clara)
    paragraphs = text.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        words = len(para.split())
        
        # Si agregar este párrafo excede el límite y ya hay contenido
        if current_length + words > chunk_size and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [para]
            current_length = words
        else:
            current_chunk.append(para)
            current_length += words
    
    # Agregar lo que queda
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
    
    return chunks


def main():
    print("=" * 60)
    print("🔨 Procesando documentos de Cúmulo...")
    print("=" * 60)
    
    docs_path = Path("documentos")
    
    if not docs_path.exists():
        print(f"❌ No encontré la carpeta 'documentos' en {Path.cwd()}")
        print("   Crea una carpeta llamada 'documentos' con tus PDFs y Docs")
        exit(1)
    
    # 1. Extraer todos los documentos
    print("\n📂 Extrayendo texto de documentos...\n")
    
    raw_documents = []
    file_count = 0
    
    for root, dirs, files in os.walk(docs_path):
        folder_name = os.path.basename(root)
        
        for file in sorted(files):
            if file.startswith('.'):  # Ignorar archivos ocultos
                continue
            
            full_path = os.path.join(root, file)
            file_size_mb = os.path.getsize(full_path) / (1024 * 1024)
            
            text = None
            
            if file.endswith('.pdf'):
                print(f"  📄 {folder_name}/{file} ({file_size_mb:.1f}MB)", end=" ... ")
                text = extract_text_from_pdf(full_path)
                if text:
                    print(f"✓ ({len(text)} caracteres)")
                else:
                    print("⚠️  (vacío)")
            
            elif file.endswith('.docx') or file.endswith('.doc'):
                print(f"  📝 {folder_name}/{file} ({file_size_mb:.1f}MB)", end=" ... ")
                text = extract_text_from_docx(full_path)
                if text:
                    print(f"✓ ({len(text)} caracteres)")
                else:
                    print("⚠️  (vacío)")
            
            elif file.endswith('.md') or file.endswith('.txt'):
                print(f"  📋 {folder_name}/{file} ({file_size_mb:.1f}MB)", end=" ... ")
                text = extract_text_from_markdown(full_path)
                if text:
                    print(f"✓ ({len(text)} caracteres)")
                else:
                    print("⚠️  (vacío)")
            
            else:
                continue  # Ignorar otros formatos
            
            if text:
                raw_documents.append({
                    "filename": file,
                    "folder": folder_name,
                    "full_path": full_path,
                    "text": text,
                    "extracted_at": datetime.now().isoformat()
                })
                file_count += 1
    
    if not raw_documents:
        print("\n❌ No encontré documentos para procesar")
        exit(1)
    
    print(f"\n✓ Extracción completada: {len(raw_documents)} documentos")
    
    # 2. Dividir en chunks con metadata
    print("\n🔀 Dividiendo en chunks...\n")
    
    knowledge_base = []
    chunk_id = 0
    
    for doc in raw_documents:
        chunks = chunk_text(doc["text"])
        date = extract_date_from_text(doc["text"], doc["filename"])
        
        print(f"  {doc['filename']}: {len(chunks)} chunks")
        
        for chunk_content in chunks:
            if chunk_content.strip():  # Solo si no está vacío
                knowledge_base.append({
                    "id": f"chunk_{chunk_id:05d}",
                    "folder": doc["folder"],
                    "filename": doc["filename"],
                    "date": date,
                    "text": chunk_content.strip(),
                    "tokens": len(chunk_content.split()),
                    "chars": len(chunk_content)
                })
                chunk_id += 1
    
    print(f"\n✓ Chunks creados: {len(knowledge_base)} total")
    
    # 3. Crear carpeta docs/ si no existe
    output_dir = Path("docs")
    output_dir.mkdir(exist_ok=True)
    
    # 4. Guardar JSON
    print("\n💾 Guardando kb.json...\n")
    
    output_file = output_dir / "kb.json"
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(knowledge_base, f, ensure_ascii=False, indent=2)
    
    file_size_kb = output_file.stat().st_size / 1024
    
    print(f"  ✓ Guardado en: {output_file}")
    print(f"  📊 Tamaño: {file_size_kb:.1f} KB")
    print(f"  📝 Total de chunks: {len(knowledge_base)}")
    print(f"  ⏰ Tokens totales: {sum(c['tokens'] for c in knowledge_base):,}")
    
    # 5. Crear un índice de metadatos
    print("\n📑 Generando índice...\n")
    
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "total_documents": len(raw_documents),
        "total_chunks": len(knowledge_base),
        "folders": {},
        "date_range": {
            "earliest": min([c['date'] for c in knowledge_base if c['date'] != 'sin_fecha'] or ['sin_datos']),
            "latest": max([c['date'] for c in knowledge_base if c['date'] != 'sin_fecha'] or ['sin_datos'])
        }
    }
    
    for chunk in knowledge_base:
        folder = chunk['folder']
        if folder not in metadata['folders']:
            metadata['folders'][folder] = {"chunks": 0, "tokens": 0}
        
        metadata['folders'][folder]['chunks'] += 1
        metadata['folders'][folder]['tokens'] += chunk['tokens']
    
    # Mostrar resumen por carpeta
    for folder, stats in sorted(metadata['folders'].items()):
        print(f"  📁 {folder}: {stats['chunks']} chunks ({stats['tokens']:,} tokens)")
    
    # Guardar metadata
    metadata_file = output_dir / "kb-metadata.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Metadatos en: {metadata_file}")
    
    # 6. Resumen final
    print("\n" + "=" * 60)
    print("✅ ¡Proceso completado exitosamente!")
    print("=" * 60)
    print("\n📌 Próximos pasos:")
    print("  1. Sube estos archivos a GitHub:")
    print("     - docs/kb.json")
    print("     - docs/index.html (si no existe, cópialo)")
    print("     - docs/kb-metadata.json")
    print("\n  2. Activa GitHub Pages en tu repo:")
    print("     Settings → Pages → Deploy from a branch")
    print("     Selecciona: main branch, /docs folder")
    print("\n  3. Tu página estará en:")
    print("     https://tu-usuario.github.io/cumulo")
    print("\n")


if __name__ == "__main__":
    main()
