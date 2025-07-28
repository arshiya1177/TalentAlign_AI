import streamlit as st
import fitz  # PyMuPDF
import docx
import os
import re
import nltk
import spacy
from nltk.corpus import stopwords
from sentence_transformers import SentenceTransformer, util

nltk.download('stopwords')
stop_words = set(stopwords.words('english'))
nlp = spacy.load("en_core_web_sm")
model = SentenceTransformer('all-MiniLM-L6-v2')  # Fast + accurate

MAX_FILE_SIZE_MB = 5

def preprocess_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = [word for word in text.split() if word not in stop_words]
    return ' '.join(tokens)

def read_pdf(file):
    doc = fitz.open(stream=file.read(), filetype="pdf")
    return ''.join([page.get_text() for page in doc])

def read_docx(file):
    doc = docx.Document(file)
    return '\n'.join([para.text for para in doc.paragraphs])

def validate_file(file):
    size_mb = file.size / (1024 * 1024)
    ext = os.path.splitext(file.name)[1].lower()
    if size_mb > MAX_FILE_SIZE_MB:
        return False, f"❌ File size exceeds {MAX_FILE_SIZE_MB}MB"
    if ext not in ['.pdf', '.docx']:
        return False, "❌ Only PDF and DOCX files are allowed"
    return True, "✅ File is valid"

def extract_skills(text):
    doc = nlp(text)
    return list(set([
        ent.text.lower()
        for ent in doc.ents
        if ent.label_ in ['ORG', 'PRODUCT', 'LANGUAGE', 'WORK_OF_ART']
    ]))

def extract_education(text):
    keywords = ["bachelor", "master", "b.tech", "m.tech", "phd", "degree", "university", "college", "graduated"]
    return ". ".join([line for line in text.split('.') if any(k in line.lower() for k in keywords)])

def extract_experience(text):
    keywords = ["experience", "worked", "intern", "internship", "project", "company", "role", "developed", "engineer"]
    return ". ".join([line for line in text.split('.') if any(k in line.lower() for k in keywords)])

def extract_structured_data(text):
    return {
        "skills": extract_skills(text),
        "education": extract_education(text),
        "experience": extract_experience(text)
    }

def calculate_similarity(text1, text2):
    emb1 = model.encode(text1, convert_to_tensor=True)
    emb2 = model.encode(text2, convert_to_tensor=True)
    similarity = util.cos_sim(emb1, emb2).item()
    return round(similarity * 100, 2)  

st.set_page_config(page_title="TalentAlign AI")
st.title("📄 TalentAlign AI - Resume vs JD Matching")

resume_file = st.file_uploader("Upload Resume (PDF or DOCX)", type=["pdf", "docx"])
jd_file = st.file_uploader("Upload Job Description (PDF or DOCX)", type=["pdf", "docx"])

if resume_file and jd_file:
    valid_resume, resume_msg = validate_file(resume_file)
    valid_jd, jd_msg = validate_file(jd_file)

    if not valid_resume or not valid_jd:
        st.error(resume_msg if not valid_resume else jd_msg)
    else:
        resume_raw = read_pdf(resume_file) if resume_file.name.endswith(".pdf") else read_docx(resume_file)
        jd_raw = read_pdf(jd_file) if jd_file.name.endswith(".pdf") else read_docx(jd_file)

        resume_clean = preprocess_text(resume_raw)
        jd_clean = preprocess_text(jd_raw)

        resume_data = extract_structured_data(resume_raw)
        jd_data = extract_structured_data(jd_raw)

        similarity_percent = calculate_similarity(resume_clean, jd_clean)
        if similarity_percent >= 75:
            verdict = "✅ Strong Match"
        elif similarity_percent >= 50:
            verdict = "⚠️ Moderate Match"
        else:
            verdict = "❌ Weak Match"

        # Output
        st.subheader("📝 Resume - Raw Text")
        st.text(resume_raw[:2000])

        st.subheader(" Job Description - Raw Text")
        st.text(jd_raw[:2000])

        st.subheader("Resume - Extracted Info")
        st.json(resume_data)

        st.subheader("JD - Extracted Info")
        st.json(jd_data)

        st.subheader("🔍 Similarity Score")
        st.metric("Semantic Similarity (%)", f"{similarity_percent}%")

        st.subheader("🎯 Match Verdict")
        if "✅" in verdict:
            st.success(verdict)
        elif "⚠️" in verdict:
            st.warning(verdict)
        else:
            st.error(verdict)