import streamlit as st
import fitz  # PyMuPDF
import requests
import json
import re
from openai import OpenAI
import time
import os
from dotenv import load_dotenv

load_dotenv()

# === Setup ===
st.set_page_config(page_title="TalentAlign AI – JD Matcher", layout="wide")
st.title("🧠 TalentAlign AI – Smart JD Matcher")
st.markdown("Find the most relevant job descriptions using AI-powered analysis.")

# === Load API Keys ===
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
QDRANT_URL = "https://qdrant-az-dev.smartx.services"
QDRANT_API_KEY = "smartx-dev"
COLLECTION_NAME = "my_new_collection"

# === Optimized Functions ===
def extract_text_from_pdf(uploaded_file):
    uploaded_file.seek(0)
    doc = fitz.open(stream=uploaded_file.read(), filetype="pdf")
    text = "\n".join([page.get_text() for page in doc])
    doc.close()
    return text

def get_embedding(text):
    response = client.embeddings.create(
        input=text[:8000],  # Token limit
        model="text-embedding-ada-002"
    )
    return response.data[0].embedding

# === Batch GPT Analysis for Efficiency ===
def analyze_multiple_jds_with_gpt(jd_list):
    """Analyze multiple JDs in one API call for efficiency"""
    if not jd_list:
        return []
    
    # Create batch prompt for multiple JDs
    batch_prompt = "Analyze these job descriptions and return a JSON array. Each object should have: job_title, company, required_skills, experience_required, location, summary.\n\n"
    
    for i, jd_text in enumerate(jd_list[:3]):  # Limit to 3 for token efficiency
        batch_prompt += f"JD {i+1}:\n{jd_text[:1500]}\n\n"
    
    batch_prompt += "Return only valid JSON array, no extra text:"
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": batch_prompt}],
            max_tokens=1500,
            temperature=0
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith('json'):
            content = content.replace('json', '').replace('```', '').strip()
        
        results = json.loads(content)
        return results if isinstance(results, list) else [results]
    
    except Exception as e:
        # Fallback to rule-based extraction
        return [extract_jd_info_fallback(jd) for jd in jd_list]

def analyze_resume_quick(resume_text):
    """Quick resume analysis with focused prompting"""
    prompt = f"""Extract key info from this resume in JSON:
    {resume_text[:2000]}
    
    Return: {{"skills": ["skill1", "skill2"], "experience_years": number, "summary": "brief summary"}}"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0
        )
        return json.loads(response.choices[0].message.content)
    except:
        return {"skills": extract_skills_fallback(resume_text), "experience_years": 5, "summary": "Experienced professional"}

# === Enhanced Fallback Functions ===
def extract_skills_fallback(text):
    """Fast skill extraction using keyword matching"""
    text_lower = text.lower()
    
    # Prioritized skill categories
    priority_skills = [
        'python', 'sql', 'java', 'javascript', 'react', 'aws', 'azure', 'docker',
        'kubernetes', 'git', 'machine learning', 'data analysis', 'excel', 'tableau'
    ]
    
    all_skills = [
        'html', 'css', 'typescript', 'node.js', 'mongodb', 'postgresql', 'mysql',
        'redis', 'elasticsearch', 'kafka', 'spark', 'hadoop', 'tensorflow', 'pytorch',
        'scikit-learn', 'pandas', 'numpy', 'matplotlib', 'power bi', 'looker', 'sas'
    ]
    
    found_skills = []
    
    # Check priority skills first
    for skill in priority_skills:
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found_skills.append(skill.title())
    
    # Add other skills if we have space
    for skill in all_skills:
        if len(found_skills) >= 10:
            break
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found_skills.append(skill.title())
    
    return found_skills

def extract_jd_info_fallback(jd_text):
    """Quick JD info extraction using patterns"""
    # Extract job title
    title_patterns = [
        r"(?:position|job title|role)[:\s]*([^\n\r]{3,50})",
        r"(?:we are hiring|looking for)\s+(?:a|an)\s*([^\n\r]{3,50})",
        r"^([A-Z][a-zA-Z\s\-/]{3,50})(?:\n|$)"
    ]
    
    job_title = "Position Available"
    for pattern in title_patterns:
        match = re.search(pattern, jd_text, re.IGNORECASE | re.MULTILINE)
        if match:
            title = re.sub(r'[^\w\s\-/()]', ' ', match.group(1)).strip()
            if 3 < len(title) < 50:
                job_title = title.title()
                break
    
    # Extract company
    company_patterns = [
        r'(?:company|organization)[:\s]*([A-Z][a-zA-Z\s&.,]{2,30})',
        r'(?:at|join)\s+([A-Z][a-zA-Z\s&.,]{2,30})'
    ]
    
    company = "Not specified"
    for pattern in company_patterns:
        match = re.search(pattern, jd_text)
        if match:
            comp = match.group(1).strip()
            if 2 < len(comp) < 40:
                company = comp
                break
    
    return {
        "job_title": job_title,
        "company": company,
        "required_skills": extract_skills_fallback(jd_text),
        "experience_required": "Not specified",
        "location": "Not specified",
        "summary": jd_text[:200] + "..."
    }

def calculate_match_score(resume_skills, jd_skills, vector_similarity):
    """Quick match score calculation"""
    # Skill matching (60%)
    if jd_skills:
        resume_skills_lower = [s.lower() for s in resume_skills]
        jd_skills_lower = [s.lower() for s in jd_skills]
        
        matches = sum(1 for jd_skill in jd_skills_lower 
                     if any(jd_skill in resume_skill or resume_skill in jd_skill 
                           for resume_skill in resume_skills_lower))
        skill_score = min(60, (matches / len(jd_skills)) * 60)
    else:
        skill_score = 30
    
    # Vector similarity (40%)
    vector_score = max(0, (vector_similarity + 1) * 20)  # Convert to 0-40 range
    
    return min(100, skill_score + vector_score)

def search_qdrant(resume_vector, top_k=5):
    """Search Qdrant database"""
    url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search"
    headers = {
        "Content-Type": "application/json",
        "api-key": QDRANT_API_KEY
    }
    payload = {
        "vector": resume_vector,
        "top": top_k,
        "with_payload": True
    }
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# === Main UI ===
st.sidebar.image("https://img.icons8.com/3d-fluency/94/artificial-intelligence.png", width=100)
st.sidebar.title("TalentAlign AI")
st.sidebar.markdown("#### 📄 Upload Resume")
uploaded_file = st.sidebar.file_uploader("Choose your resume (PDF)", type="pdf")

st.markdown("""
<style>
    .match-score {
        background-color: #1f2937;
        color: white;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: bold;
        display: inline-block;
    }
    .skill-tag {
        display: inline-block;
        background-color: #e0f2fe;
        color: #0284c7;
        padding: 4px 10px;
        border-radius: 12px;
        margin: 4px;
        font-size: 14px;
    }
</style>
""", unsafe_allow_html=True)

if uploaded_file:
    st.success("✅ Resume uploaded!")

    # Cache analysis
    if 'resume_analysis' not in st.session_state or st.session_state.get('file_name') != uploaded_file.name:
        with st.spinner("🤖 Analyzing resume..."):
            st.session_state.resume_text = extract_text_from_pdf(uploaded_file)
            st.session_state.resume_analysis = analyze_resume_quick(st.session_state.resume_text)
            st.session_state.resume_vector = get_embedding(st.session_state.resume_text)
            st.session_state.file_name = uploaded_file.name

    analysis = st.session_state.resume_analysis

    # === Display Resume Details ===
    st.markdown("## 👤 Resume Overview")
    st.markdown(f"**📝 Summary:** {analysis.get('summary', 'No summary available')}")
    st.markdown(f"**📈 Experience:** {analysis.get('experience_years', 'N/A')} years")

    st.markdown("**💼 Key Skills:**")
    skills_html = "".join([f"<span class='skill-tag'>{skill}</span>" for skill in analysis.get('skills', [])[:10]])
    st.markdown(skills_html, unsafe_allow_html=True)

    # === Find Matches ===
    st.markdown("---")
    st.markdown("## 🎯 AI Matched Jobs")

    with st.spinner("🔍 Searching top matches..."):
        result = search_qdrant(st.session_state.resume_vector, top_k=5)
        matches = result.get("result", [])

        if matches:
            jd_texts = [match["payload"]["text"] for match in matches if "text" in match.get("payload", {})]
            jd_analyses = []

            if len(jd_texts) > 0:
                gpt_analyses = analyze_multiple_jds_with_gpt(jd_texts[:3])
                for i, match in enumerate(matches):
                    if i < len(gpt_analyses):
                        jd_analyses.append(gpt_analyses[i])
                    else:
                        jd_analyses.append(extract_jd_info_fallback(match["payload"]["text"]))

            resume_skills = analysis.get('skills', [])

            for i, (match, jd) in enumerate(zip(matches, jd_analyses), 1):
                vector_similarity = match["score"]
                score = calculate_match_score(resume_skills, jd.get("required_skills", []), vector_similarity)

                if score >= 75:
                    color = "#10b981"
                elif score >= 60:
                    color = "#f59e0b"
                else:
                    color = "#6b7280"

                st.markdown(f"### 🏆 Match #{i}: {jd.get('job_title', 'Available Position')}")
                st.markdown(f"<div class='match-score' style='background-color: {color};'>{score:.0f}% Match</div>", unsafe_allow_html=True)

                st.markdown(f"**🏢 Company:** {jd.get('company', 'Not specified')}")
                st.markdown(f"**📍 Location:** {jd.get('location', 'Not specified')}")
                st.markdown(f"**💼 Experience Required:** {jd.get('experience_required', 'Not specified')}")
                st.markdown(f"**📊 Similarity Score:** {max(0, (vector_similarity + 1) * 50):.0f}%")

                if jd.get("required_skills"):
                    st.markdown("**🛠️ Skills Required:**")
                    skill_tags = ""
                    for skill in jd["required_skills"][:6]:
                        skill_lower = skill.lower()
                        is_match = any(skill_lower in rs.lower() or rs.lower() in skill_lower for rs in resume_skills)
                        style = "✅" if is_match else "⚪"
                        skill_tags += f"<span class='skill-tag'>{style} {skill}</span>"
                    st.markdown(skill_tags, unsafe_allow_html=True)

                st.markdown("**📝 Summary:**")
                st.write(jd.get("summary", "No summary provided"))

                with st.expander("📄 View Full JD"):
                    st.text(match["payload"]["text"][:2000] + "...")

                st.markdown("---")
        else:
            st.warning("⚠️ No job matches found.")
else:
    st.markdown("## 🚀 Start by uploading your resume")
    st.markdown("""
    - 🧠 Intelligent resume parsing
    - 🔍 Matches from JD database
    - 💯 Skill + semantic matching
    - 🧾 PDF only
    """)