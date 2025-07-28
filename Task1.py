# --- TASK 1: Upload and Extract Raw Text from PDFs using fitz (PyMuPDF) ---

import streamlit as st
import fitz  # PyMuPDF

def read_pdf(file):
    doc = fitz.open(stream=file.read(), filetype="pdf")
    return ''.join([page.get_text() for page in doc])

st.title("📄 Resume and JD Text Extractor")

resume_pdf = st.file_uploader("Upload Resume (PDF only)", type=["pdf"])
jd_pdf = st.file_uploader("Upload Job Description (PDF only)", type=["pdf"])

if resume_pdf and jd_pdf:
    resume_text = read_pdf(resume_pdf)
    jd_text = read_pdf(jd_pdf)

    st.subheader("📝 Resume - Raw Text")
    st.text(resume_text[:2000])

    st.subheader("📋 JD - Raw Text")
    st.text(jd_text[:2000])
