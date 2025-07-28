# --- TASK 2: Clean & Normalize Text ---

import streamlit as st
import fitz  # PyMuPDF
import re
import nltk
from nltk.corpus import stopwords

nltk.download('stopwords')
stop_words = set(stopwords.words('english'))

def read_pdf(file):
    doc = fitz.open(stream=file.read(), filetype="pdf")
    return ''.join([page.get_text() for page in doc])

resume_pdf = st.file_uploader("Upload Resume (PDF only)", type=["pdf"])
jd_pdf = st.file_uploader("Upload Job Description (PDF only)", type=["pdf"])

if resume_pdf and jd_pdf:
    resume_text = read_pdf(resume_pdf)
    jd_text = read_pdf(jd_pdf)

    st.subheader("📝 Resume - Raw Text")
    st.text(resume_text[:2000])

    st.subheader("📋 JD - Raw Text")
    st.text(jd_text[:2000])

def preprocess_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)          # Remove non-alphabetic characters
    text = re.sub(r'\s+', ' ', text).strip()       # Normalize whitespace
    tokens = [word for word in text.split() if word not in stop_words]
    return ' '.join(tokens)
