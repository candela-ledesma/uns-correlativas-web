#Extrae texto del PDF.

import pdfplumber


def extraer_texto(pdf_path):
    texto = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            contenido = page.extract_text()
            if contenido:
                texto += contenido + "\n"
                
    #print(texto)  # Agrega esta línea para imprimir el texto extraído

    return texto