import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
    Upload, FileText, Brain, Target, Award, ChevronDown, ChevronUp, Users,
    GraduationCap, AlertCircle, CheckCircle, Loader2, Filter, Sliders, TrendingUp,
    Star, Briefcase, Sun, Moon, Menu, X, Search, BarChart3, Sparkles,
    ArrowRight, BookOpen, Code, Database, Layers, Cpu, Rocket, Mail, Send, Trash2, PlusCircle, Server, Eye, Library, Files, Download, XCircle
} from 'lucide-react';
import { FaHandshake } from "react-icons/fa";
import MissingSkills from './missingskills';

// --- INTERFACES ---

interface SectionScores {
    skills: number;
    experience: number;
    education: number;
}

interface JobMatch {
    id: string;
    score: number;
    payload: {
        title: string;
        description: string;
    };
    scores_breakdown: SectionScores;
    weights_used: SectionScores;
    missing_skills?: Array<{
        skill: string;
        importance: string;
        category: string;
    }>;
    job_skills?: string;
    resume_skills?: string;
}

interface CandidateProfile {
    skills: string;
    experience: string;
    education: string;
}

interface CandidateMatch {
    score: number;
    payload: {
        file_name: string;
        extracted_profile: CandidateProfile;
    };
    scores_breakdown: SectionScores;
    weights_used: SectionScores;
}

interface BulkAnalysisResult {
    job_description_payload: {
        file_name: string;
        extracted_data: {
            skills: string;
            experience: string;
            education: string;
        }
    };
    candidate_matches: CandidateMatch[];
}


interface ProcessingStep {
    id: number;
    message: string;
    status: 'pending' | 'active' | 'completed' | 'error';
}

interface JD {
    id: string;
    payload: {
        file_name: string;
        full_text: string;
    };
}

type EmailStatus = 'idle' | 'success' | 'error';
type View = 'candidate' | 'admin' | 'bulk';
type SortKey = 'score' | 'skills' | 'experience' | 'education';

// --- UTILITY & HELPER COMPONENTS ---

const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <div className={`relative overflow-hidden rounded-2xl p-6 ${color} border border-slate-200/50 dark:border-slate-800 backdrop-blur-sm hover:scale-105 transition-all duration-300 group`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-slate-900/20"></div>
        <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
                <Icon className="h-8 w-8 text-slate-700 dark:text-white/80" />
                <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
                    <div className="text-sm text-slate-500 dark:text-white/70">{subtitle}</div>
                </div>
            </div>
            <h3 className="font-medium text-slate-800 dark:text-white/90">{title}</h3>
        </div>
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-black/5 dark:bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
    </div>
);

const Modal = ({ isOpen, onClose, onConfirm, title, children, confirmText = "Confirm Delete" }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, children: React.ReactNode, confirmText?: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-800 animate-fade-in-up">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white-100 dark:bg-black-900/30 rounded-xl">
                            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <div className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    {children}
                </div>
                <div className="flex justify-end space-x-4">
                    {/* <button onClick={onClose} className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        Cancel
                    </button> */}
                    <button onClick={onConfirm} className="px-6 py-3 font-semibold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- CONTEXT PROVIDERS (STATE MANAGEMENT) ---

// 1. Admin View Context
const AdminContext = createContext<any>(null);

const AdminProvider = ({ children }: { children: React.ReactNode }) => {
    const [jds, setJds] = useState<JD[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // MODIFIED: From single file to array
    const [isUploading, setIsUploading] = useState(false);
    const [jdToDelete, setJdToDelete] = useState<JD | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [viewingJd, setViewingJd] = useState<JD | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    const fetchJDs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:5000/api/jds');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch job descriptions.');
            }
            const data = await response.json();
            setJds(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if(jds.length === 0) {
            fetchJDs();
        }
    }, [fetchJDs, jds.length]);

    const value = {
        jds, setJds,
        isLoading, setIsLoading,
        error, setError,
        selectedFiles, setSelectedFiles, // MODIFIED
        isUploading, setIsUploading,
        jdToDelete, setJdToDelete,
        isDeleting, setIsDeleting,
        viewingJd, setViewingJd,
        currentPage, setCurrentPage,
        fetchJDs
    };

    return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
const useAdmin = () => useContext(AdminContext);


// 2. Candidate View Context
const CandidateContext = createContext<any>(null);

const CandidateProvider = ({ children }: { children: React.ReactNode }) => {
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
    const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
    const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
    const [expandedJob, setExpandedJob] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scoreThreshold, setScoreThreshold] = useState(0.0);
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
    const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    
    // Function to reset the state for a new analysis
    const handleReset = () => {
        setUploadedFile(null);
        setUserEmail('');
        setIsDragOver(false);
        setIsProcessing(false);
        setProcessingSteps([]);
        setCandidateProfile(null);
        setJobMatches([]);
        setExpandedJob(null);
        setError(null);
        setScoreThreshold(0.0);
        setShowFilters(false);
        setActiveTab('overview');
        setEmailStatus('idle');
        setIsSendingEmail(false);
    };

    const value = {
        uploadedFile, setUploadedFile,
        userEmail, setUserEmail,
        isDragOver, setIsDragOver,
        isProcessing, setIsProcessing,
        processingSteps, setProcessingSteps,
        candidateProfile, setCandidateProfile,
        jobMatches, setJobMatches,
        expandedJob, setExpandedJob,
        error, setError,
        scoreThreshold, setScoreThreshold,
        showFilters, setShowFilters,
        activeTab, setActiveTab,
        emailStatus, setEmailStatus,
        isSendingEmail, setIsSendingEmail,
        handleReset // Expose the reset function
    };
    return <CandidateContext.Provider value={value}>{children}</CandidateContext.Provider>;
};
const useCandidate = () => useContext(CandidateContext);


// 3. Bulk Analysis Context
const BulkAnalysisContext = createContext<any>(null);

const BulkAnalysisProvider = ({ children }: { children: React.ReactNode }) => {
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [resumeFiles, setResumeFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<BulkAnalysisResult | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>('score');
    const [searchQuery, setSearchQuery] = useState('');

    const value = {
        jdFile, setJdFile,
        resumeFiles, setResumeFiles,
        isProcessing, setIsProcessing,
        error, setError,
        results, setResults,
        sortBy, setSortBy,
        searchQuery, setSearchQuery
    };

    return <BulkAnalysisContext.Provider value={value}>{children}</BulkAnalysisContext.Provider>;
};
const useBulkAnalysis = () => useContext(BulkAnalysisContext);


// --- ADMIN VIEW COMPONENT ---
function AdminView() {
    const {
        jds, setJds, isLoading, error, setError, selectedFiles, setSelectedFiles,
        isUploading, setIsUploading, jdToDelete, setJdToDelete, isDeleting, setIsDeleting,
        viewingJd, setViewingJd, currentPage, setCurrentPage
    } = useAdmin();
    
    const [searchTerm, setSearchTerm] = useState('');

    const filteredJds = jds.filter((jd: JD) =>
        jd.payload.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const itemsPerPage = 6;
    const totalPages = Math.ceil(filteredJds.length / itemsPerPage);

    useEffect(() => {
        if (currentPage !== 0) {
            setCurrentPage(0);
        }
    }, [searchTerm]);


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const pdfFiles = files.filter(file => file.type === 'application/pdf');

            if (pdfFiles.length !== files.length) {
                setError('Some files were not PDFs and were ignored.');
            } else {
                setError(null);
            }
            
            setSelectedFiles((prevFiles: File[]) => {
                const existingNames = new Set(prevFiles.map(f => f.name));
                const newUniqueFiles = pdfFiles.filter(f => !existingNames.has(f.name));
                return [...prevFiles, ...newUniqueFiles];
            });
            e.target.value = '';
        }
    };
    
    const handleRemoveFile = (fileName: string) => {
        setSelectedFiles((prevFiles: File[]) => prevFiles.filter(f => f.name !== fileName));
    };

const handleUpload = async () => {
    if (selectedFiles.length === 0) {
        setError('Please select at least one PDF file to upload.');
        return;
    }
    setIsUploading(true);
    setError(null);
    
    const newJds: JD[] = [];
    // This will now store detailed messages for duplicates or failures.
    const uploadIssues: string[] = [];

    // Process each file individually to handle different outcomes.
    for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('jd', file);

        try {
            const response = await fetch('http://localhost:5000/api/upload-jd', {
                method: 'POST',
                body: formData,
            });

            // Specific check for 409 Conflict (Duplicate JD)
            if (response.status === 409) {
                const errData = await response.json();
                const existingFileName = errData.existing_jd?.file_name || 'an existing file';
                uploadIssues.push(`"${file.name}" was not uploaded because it is a duplicate of "${existingFileName}".`);
                continue; // Move to the next file
            }

            // Handle other non-successful responses
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
                uploadIssues.push(`Failed to upload "${file.name}": ${errData.error || 'Unknown server error'}`);
                continue; // Move to the next file
            }

            // Handle successful upload
            const newJd = await response.json();
            newJds.push(newJd);

        } catch (err) {
            // Handle network errors (e.g., server is down)
            uploadIssues.push(`Network error while uploading "${file.name}". Please check your connection.`);
            console.error(`Error uploading ${file.name}:`, err);
        }
    }
    
    // Update the state with any newly added JDs
    if (newJds.length > 0) {
        setJds((prevJds: JD[]) => [...newJds, ...prevJds]);
    }

    // Display any collected error or duplicate messages
    if (uploadIssues.length > 0) {
        setError(`Upload process finished.\n\n- ${uploadIssues.join('\n- ')}`);
    }

    setSelectedFiles([]);
    setIsUploading(false);
};

    const handleDelete = async () => {
        if (!jdToDelete) return;
        
        setIsDeleting(jdToDelete.id);
        setError(null);

        try {
            const response = await fetch(`http://localhost:5000/api/delete-jd/${jdToDelete.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to delete JD.');
            }
            setJds((prevJds: JD[]) => prevJds.filter(jd => jd.id !== jdToDelete.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during deletion.');
        } finally {
            setIsDeleting(null);
            setJdToDelete(null);
        }
    };

    const currentJds = filteredJds.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    return (
        <div className="space-y-8 lg:space-y-12 animate-fade-in-up">
            <Modal
                isOpen={!!jdToDelete}
                onClose={() => setJdToDelete(null)}
                onConfirm={handleDelete}
                title="Confirm Deletion"
            >
                <p>Are you sure you want to permanently delete the job description for <strong className="text-slate-800 dark:text-slate-200">{jdToDelete?.payload.file_name}</strong>? This action cannot be undone.</p>
            </Modal>

            <Modal
                isOpen={!!viewingJd}
                onClose={() => setViewingJd(null)}
                onConfirm={() => setViewingJd(null)}
                title={viewingJd?.payload.file_name || "Job Description"}
                confirmText='Close'
            >
                <div className="max-h-96 overflow-y-auto custom-scrollbar pr-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                        {viewingJd?.payload.full_text || "No content available."}
                    </pre>
                </div>
            </Modal>

            <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                    JD Management
                </h2>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
                    Upload, view, and manage all job descriptions in the database.
                </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl">
                        <PlusCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Upload New Job Descriptions</h3>
                        <p className="text-slate-500 dark:text-slate-400">Add new JDs to the Qdrant vector database.</p>
                    </div>
                </div>

                {error && (
    <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 flex items-start justify-between space-x-4 animate-fade-in-up">
        {/* Left side: Icon and Text */}
        <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap pr-2">{error}</span>
        </div>

        {/* Right side: Close Button */}
        <button
            onClick={() => setError(null)}
            aria-label="Dismiss error message"
            className="p-1 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors flex-shrink-0"
        >
            <X className="h-5 w-5" />
        </button>
    </div>
)}
                
                {selectedFiles.length > 0 && (
                    <div className="mb-6 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <h4 className="font-semibold text-slate-700 dark:text-slate-300">Files to Upload:</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {selectedFiles.map((file: File) => (
                                <div key={file.name} className="flex items-center justify-between p-2 pl-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm animate-fade-in-up">
                                    <div className="flex items-center gap-3 truncate">
                                        <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                        <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                                    </div>
                                    <button onClick={() => handleRemoveFile(file.name)} className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                                        <XCircle className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label htmlFor="jd-upload-admin" className="w-full sm:flex-1 cursor-pointer">
                        <div className="flex items-center space-x-4 p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                            <Upload className="h-6 w-6 text-slate-500" />
                            <div className="truncate">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {selectedFiles.length > 0 
                                        ? `${selectedFiles.length} file(s) selected` 
                                        : 'Choose PDF file(s)...'}
                                </span>
                            </div>
                        </div>
                    </label>
                    <input
                        type="file"
                        id="jd-upload-admin"
                        accept=".pdf"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={isUploading || selectedFiles.length === 0}
                        className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center space-x-2 px-6 py-4 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        <span>
                            {isUploading 
                                ? 'Uploading...' 
                                : `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} JD(s)`}
                        </span>
                    </button>
                </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-2xl">
                        <Database className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Available Job Descriptions</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            Showing {filteredJds.length} of {jds.length} JDs.
                        </p>
                    </div>
                </div>

                {/* This outer div uses flexbox to push the search bar to the right */}
<div className="flex justify-end mb-6">
    {/* This inner div controls the search bar's width and positions the icon */}
    <div className="relative w-full md:w-1/2 lg:w-1/3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by file name..."
            // The input now takes the full width of its parent container
            className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
        />
    </div>
</div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-16">
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                    </div>
                ) : jds.length === 0 ? (
                    <div className="text-center py-16">
                        <Server className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                        <h4 className="text-xl font-bold text-slate-700 dark:text-slate-300">Database is Empty</h4>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Upload a job description to get started.</p>
                    </div>
                ) : filteredJds.length === 0 ? (
                     <div className="text-center py-16">
                        <Search className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                        <h4 className="text-xl font-bold text-slate-700 dark:text-slate-300">No Matching JDs Found</h4>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Try a different search term or clear the search.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentJds.map((jd: JD) => (
                                <div key={jd.id} className="bg-white dark:bg-slate-950 rounded-2xl p-5 shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-xl hover:scale-105 transition-all duration-300">
                                    <div className="flex-1 mb-4">
                                        <div className="flex items-center space-x-3 mb-3">
                                            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate" title={jd.payload.file_name}>
                                                {jd.payload.file_name}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 break-all">ID: {jd.id}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setViewingJd(jd)} className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-semibold text-slate-850 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                            <Eye className="h-4 w-4" />
                                            <span>View</span>
                                        </button>
                                        <button
                                            onClick={() => setJdToDelete(jd)}
                                            disabled={isDeleting === jd.id}
                                            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isDeleting === jd.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center mt-6 space-x-4">
                                <button
                                    onClick={() => setCurrentPage((p: number) => Math.max(p - 1, 0))}
                                    disabled={currentPage === 0}
                                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-700 dark:to-orange-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-slate-100 dark:text-white hover:from-red-700 hover:to-orange-700 dark:hover:from-red-800 dark:hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-all duration-200 ease-in-out">
                                    Prev
                                </button>
                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p: number) => Math.min(p + 1, totalPages - 1))}
                                    disabled={currentPage >= totalPages - 1}
                                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-700 dark:to-orange-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-slate-100 dark:text-white hover:from-red-700 hover:to-orange-700 dark:hover:from-red-800 dark:hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-all duration-200 ease-in-out">
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}


// --- CANDIDATE VIEW COMPONENT (Unchanged) ---

function CandidateView() {
    const {
        uploadedFile, setUploadedFile, userEmail, setUserEmail, isDragOver, setIsDragOver,
        isProcessing, setIsProcessing, processingSteps, setProcessingSteps, candidateProfile, setCandidateProfile,
        jobMatches, setJobMatches, expandedJob, setExpandedJob, error, setError,
        scoreThreshold, setScoreThreshold, showFilters, setShowFilters, activeTab, setActiveTab,
        emailStatus, setEmailStatus, isSendingEmail, setIsSendingEmail,
        handleReset // Get the reset function from context
    } = useCandidate();

    useEffect(() => {
        if (emailStatus !== 'idle') {
            const timer = setTimeout(() => setEmailStatus('idle'), 5000);
            return () => clearTimeout(timer);
        }
    }, [emailStatus, setEmailStatus]);

    const initializeProcessingSteps = () => {
        return [
            { id: 1, message: "Extracting candidate profile from resume...", status: 'pending' as const },
            { id: 2, message: "Creating focused search query...", status: 'pending' as const },
            { id: 3, message: "Searching Qdrant database for relevant jobs...", status: 'pending' as const },
            { id: 4, message: "Analyzing job matches with OpenAI...", status: 'pending' as const },
            { id: 5, message: "Ranking and scoring results...", status: 'pending' as const },
        ];
    };

    const updateProcessingStep = (stepId: number, status: 'active' | 'completed' | 'error', skipRemaining = false) => {
        setProcessingSteps((prev: ProcessingStep[]) =>
            prev.map(step => {
                if (step.id === stepId) return { ...step, status };
                if (skipRemaining && step.id > stepId) return { ...step, status: 'completed' };
                return step;
            })
        );
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files[0].type === 'application/pdf') {
            setUploadedFile(files[0]);
            setError(null);
        } else {
            setError('Please upload a PDF file only.');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].type === 'application/pdf') {
                setUploadedFile(e.target.files[0]);
                setError(null);
            } else {
                setError('Please upload a PDF file only.');
            }
        }
    };

    const handleAnalyze = async () => {
        if (!uploadedFile) {
            setError("Please upload a resume file.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setCandidateProfile(null);
        setJobMatches([]);
        setProcessingSteps(initializeProcessingSteps());
        setActiveTab('overview');
        setEmailStatus('idle');

        try {
            updateProcessingStep(1, 'active');
            
            const formData = new FormData();
            formData.append('resume', uploadedFile);

            const response = await fetch('http://localhost:5000/api/analyze-resume', {
                method: 'POST',
                body: formData,
            });

            await new Promise(res => setTimeout(res, 300));
            updateProcessingStep(1, 'completed');
            updateProcessingStep(2, 'active');
            await new Promise(res => setTimeout(res, 300));
            updateProcessingStep(2, 'completed');
            updateProcessingStep(3, 'active');
            await new Promise(res => setTimeout(res, 500));
            updateProcessingStep(3, 'completed');
            updateProcessingStep(4, 'active');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            updateProcessingStep(4, 'completed');
            updateProcessingStep(5, 'active');

            const result = await response.json();
            
            // Debug: Log the response to see if missing skills are included
            console.log('API Response:', result);
            console.log('Job Matches:', result.job_matches);
            if (result.job_matches && result.job_matches.length > 0) {
                console.log('First job match missing skills:', result.job_matches[0].missing_skills);
                console.log('All job matches with missing skills:');
                result.job_matches.forEach((job: JobMatch, index: number) => {
                    console.log(`Job ${index + 1}: ${job.payload.title} - Missing skills:`, job.missing_skills);
                });
            }
            
            await new Promise(res => setTimeout(res, 300));
            updateProcessingStep(5, 'completed');
            
            setCandidateProfile(result.candidate_profile);
            setJobMatches(result.job_matches);
            
            setActiveTab('matches');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(`Failed to analyze resume: ${errorMessage}`);
            
            setProcessingSteps((prev: ProcessingStep[]) => 
                prev.map(step => 
                    step.status === 'active' ? { ...step, status: 'error' } : step
                )
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendEmail = async () => {
        if (!userEmail || !userEmail.includes('@')) {
            setError("Please enter a valid email address to send the results.");
            setEmailStatus('error');
            return;
        }
        if (!candidateProfile || jobMatches.length === 0) {
            setError("Cannot send email: required analysis data is missing.");
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus('idle');
        setError(null);

        try {
            const response = await fetch('http://localhost:5000/api/send-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    job_matches: jobMatches,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Server failed to send email.");
            }
            
            const result = await response.json();
            if (result.email_sent) {
                setEmailStatus('success');
            } else {
                throw new Error(result.error || "An unknown error occurred while sending email.");
            }
        } catch (err) {
            setEmailStatus('error');
            const errorMessage = err instanceof Error ? err.message : 'Failed to send email.';
            setError(errorMessage);
        } finally {
            setIsSendingEmail(false);
        }
    };

    const toggleJobExpansion = (jobId: string) => {
        setExpandedJob(expandedJob === jobId ? null : jobId);
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.8) return 'text-emerald-500 dark:text-emerald-400';
        if (score >= 0.6) return 'text-blue-500 dark:text-blue-400';
        if (score >= 0.4) return 'text-amber-500 dark:text-amber-400';
        return 'text-red-500 dark:text-red-400';
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 0.8) return 'bg-gradient-to-r from-emerald-500 to-green-500';
        if (score >= 0.6) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
        if (score >= 0.4) return 'bg-gradient-to-r from-amber-500 to-orange-500';
        return 'bg-gradient-to-r from-red-500 to-pink-500';
    };

    const filteredJobMatches = jobMatches.filter((job: JobMatch) => job.score >= scoreThreshold);

    const getMatchQuality = (score: number) => {
        if (score >= 0.8) return { 
            label: 'Excellent Match', color: 'text-emerald-600 dark:text-emerald-400', 
            bgColor: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800', 
            icon: Star, badgeColor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
        };
        if (score >= 0.6) return { 
            label: 'Good Match', color: 'text-blue-600 dark:text-blue-400', 
            bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800', 
            icon: TrendingUp, badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        };
        if (score >= 0.4) return { 
            label: 'Fair Match', color: 'text-amber-600 dark:text-amber-400', 
            bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800', 
            icon: Target, badgeColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        };
        return { 
            label: 'Poor Match', color: 'text-red-600 dark:text-red-400', 
            bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800', 
            icon: AlertCircle, badgeColor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        };
    };

    return (
        <>
            {!candidateProfile && !isProcessing && (
                <div className="text-center mb-12 lg:mb-16 animate-fade-in-up">
                    <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-2xl opacity-20"></div>
                        <h2 className="relative text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent leading-tight">
                            Find Your Perfect <br />
                            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">Job Match</span>
                        </h2>
                    </div>
                    <p className="text-xl lg:text-2xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed font-medium">
                        Upload your resume and discover the most relevant opportunities,
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold"> powered by AI</span>.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 mt-8">
                        {[
                            { icon: Brain, text: 'AI-Powered Analysis' },
                            { icon: Database, text: 'Vector Search (Qdrant)' },
                            { icon: Send, text: 'Email Notifications' }
                        ].map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2 px-4 py-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-full border border-white/20 dark:border-slate-800/50 hover:scale-105 transition-all duration-300">
                                <feature.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="max-w-2xl mx-auto mb-8 animate-slide-in-right">
                    <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border border-red-200 dark:border-red-800 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-pink-500/10"></div>
                        <div className="relative flex items-start space-x-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Analysis Error</h3>
                                <p className="text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!candidateProfile && !isProcessing && (
                <div className="max-w-3xl mx-auto mb-12 animate-fade-in-up">
                    <div
                        className={`relative overflow-hidden border-2 border-dashed rounded-3xl p-8 lg:p-12 text-center transition-all duration-500 ${isDragOver
                                ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 scale-105 shadow-2xl'
                                : uploadedFile
                                    ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 shadow-xl'
                                    : 'border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-blue-950/10 dark:hover:to-purple-950/10 hover:shadow-xl'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {uploadedFile ? (
                            <div className="relative space-y-6 animate-fade-in-up">
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-xl opacity-30"></div>
                                    <div className="relative p-4 lg:p-6 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-950/30 dark:to-green-950/30 rounded-2xl">
                                        <FileText className="h-12 w-12 lg:h-16 lg:w-16 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-xl lg:text-2xl font-bold text-emerald-800 dark:text-emerald-200">File Ready!</h3>
                                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
                                        <p className="text-emerald-700 dark:text-emerald-300 font-semibold break-all">{uploadedFile.name}</p>
                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isProcessing}
                                    className="relative group inline-flex items-center px-8 lg:px-12 py-4 lg:py-5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold text-lg rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                                    <Sparkles className="relative h-6 w-6 mr-3" />
                                    <span className="relative">Analyze with AI</span>
                                    <ArrowRight className="relative h-6 w-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative space-y-6">
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-20"></div>
                                    <div className="relative p-4 lg:p-6 bg-gradient-to-br from-slate-100 to-blue-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
                                        <Upload className="h-12 w-12 lg:h-16 lg:w-16 text-slate-600 dark:text-slate-400 mx-auto" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-200">Upload Your Resume</h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-md mx-auto">
                                        Drag and drop your resume PDF here, or click to browse
                                    </p>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="resume-upload"
                                    />
                                    <label
                                        htmlFor="resume-upload"
                                        className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold rounded-2xl transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105"
                                    >
                                        <FileText className="h-5 w-5 mr-2" />
                                        Choose PDF File
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="max-w-3xl mx-auto mb-12 animate-fade-in-up">
                    <div className="relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                        <div className=" absolute inset-0 bg-gradient-to-br  from-slate-200/75 via-stone-200/80 to-zinc-200/85 dark:from-slate-900/90 dark:via-slate-800/92 dark:to-slate-950/95 backdrop-blur-sm contrast-125 "></div>


                        <div className="relative text-center mb-8">
                            <div className="relative inline-block mb-6">
                                <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-10"></div>
                               <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-30"></div>
                                <div className="relative p-4 lg:p-6 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/30 dark:to-orange-950/30 rounded-2xl">
                                  <FaHandshake className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 dark:text-orange-400" />
                                </div>

                            </div>
                            <h3 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-200 mb-3">AI Analysis in Progress</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">Processing your resume and searching for the best matches...</p>
                        </div>
                        <div className="space-y-4">
                            {processingSteps.map((step: ProcessingStep) => (
                                <div key={step.id} className="flex items-center space-x-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 transition-all duration-300">
                                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${step.status === 'completed'
                                            ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
                                            : step.status === 'active'
                                                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                                : step.status === 'error'
                                                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                                        }`}>
                                        {step.status === 'completed' ? (
                                            <CheckCircle className="h-5 w-5" />
                                        ) : step.status === 'error' ? (
                                            <AlertCircle className="h-5 w-5" />
                                        ) : step.status === 'active' ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            step.id
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <span className={`text-base lg:text-lg font-medium transition-all duration-300 ${step.status === 'completed'
                                                ? 'text-emerald-700 dark:text-emerald-300'
                                                : step.status === 'active'
                                                    ? 'text-orange-700 dark:text-orange-400'
                                                    : step.status === 'error'
                                                        ? 'text-red-700 dark:text-red-300'
                                                        : 'text-slate-500 dark:text-slate-400'
                                            }`}>
                                            {step.message}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {candidateProfile && !isProcessing && (
                <div className="space-y-8 lg:space-y-12 animate-fade-in-up">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
                        <div className="flex bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-2 border border-white/20 dark:border-slate-800/50 shadow-lg">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${activeTab === 'overview'
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Users className="h-5 w-5" />
                                <span>Profile Overview</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('matches')}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${activeTab === 'matches'
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                <Award className="h-5 w-5" />
                                <span>Job Matches ({jobMatches.length})</span>
                            </button>
                        </div>
                         <button onClick={handleReset} className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                            <Rocket className="h-4 w-4" />
                            <span>Start New Analysis</span>
                        </button>
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard icon={Target} title="Skills Extracted" value={candidateProfile.skills ? candidateProfile.skills.split(',').length : 0} subtitle="Technical Skills" color="bg-gradient-to-br from-blue-100 to-slate-50 dark:from-blue-800/50 dark:to-slate-900/50" />
                                <StatCard icon={Briefcase} title="Experience Level" value={candidateProfile.experience ? "Professional" : "Entry"} subtitle="Career Stage" color="bg-gradient-to-br from-purple-100 to-slate-50 dark:from-purple-800/50 dark:to-slate-900/50" />
                                <StatCard icon={GraduationCap} title="Education" value={candidateProfile.education ? "Qualified" : "N/A"} subtitle="Academic Background" color="bg-gradient-to-br from-emerald-100 to-slate-50 dark:from-emerald-800/50 dark:to-slate-900/50" />
                                <StatCard icon={BarChart3} title="Job Matches" value={jobMatches.length} subtitle="Found Opportunities" color="bg-gradient-to-br from-red-100 to-slate-50 dark:from-red-800/50 dark:to-slate-900/50" />
                            </div>
                            

                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                                <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                                    <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl">
                                        <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-200">Candidate Profile</h3>
                                        <p className="text-slate-600 dark:text-slate-400">AI-extracted information from your resume</p>
                                    </div>
                                    <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full border border-blue-200 dark:border-blue-700">
                                        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI Processed</span>
                                    </div>
                                </div>
                                <div className="grid lg:grid-cols-3 gap-8">
                                    {[
                                        { icon: Code, title: 'Technical Skills', content: candidateProfile.skills, color: 'from-blue-500 to-cyan-500' },
                                        { icon: Briefcase, title: 'Professional Experience', content: candidateProfile.experience, color: 'from-purple-500 to-pink-500' },
                                        { icon: BookOpen, title: 'Educational Background', content: candidateProfile.education, color: 'from-emerald-500 to-green-500' }
                                    ].map((section, index) => (
                                        <div key={index} className="group">
                                            <div className="flex items-center space-x-3 mb-4">
                                                <div className={`p-2 bg-gradient-to-r ${section.color} rounded-xl shadow-lg`}>
                                                    <section.icon className="h-5 w-5 text-white" />
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg">{section.title}</h4>
                                            </div>
                                            <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 group-hover:shadow-lg transition-all duration-300 h-48 overflow-y-auto custom-scrollbar">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-slate-700/50"></div>
                                                <p className="relative text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    {section.content || 'No information extracted from resume'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        jobMatches.length > 0 ? (
                            <div className="space-y-8">
                                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20 dark:border-slate-800/50">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between space-y-4 xl:space-y-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-xl">
                                                    <Award className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-200">Job Matches</h3>
                                            </div>
                                            <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-full border border-emerald-200 dark:border-emerald-700">
                                                <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                    {filteredJobMatches.length} of {jobMatches.length} Results
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => setShowFilters(!showFilters)}
                                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${showFilters
                                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                    }`}
                                            >
                                                <Sliders className="h-4 w-4" />
                                                <span>Filters</span>
                                                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    {showFilters && (
                                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 animate-fade-in-up">
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
                                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                            Minimum Match Score: {(scoreThreshold * 100).toFixed(0)}%
                                                        </label>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                                            Showing {filteredJobMatches.length} of {jobMatches.length} jobs
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        <label htmlFor="score-threshold" className="sr-only">
                                                            Minimum Match Score
                                                        </label>

                                                        <input
                                                            id="score-threshold"
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.05"
                                                            value={scoreThreshold}
                                                            onChange={(e) => setScoreThreshold(parseFloat(e.target.value))}
                                                            className="w-full h-3 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 dark:from-red-800 dark:via-yellow-800 dark:to-green-800 rounded-lg appearance-none cursor-pointer slider-enhanced"
                                                        />

                                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                                                            <span>0%</span>
                                                            <span className="hidden sm:inline">25%</span>
                                                            <span>50%</span>
                                                            <span className="hidden sm:inline">75%</span>
                                                            <span>100%</span>
                                                        </div>
                                                    </div>

                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {[
                                                        { label: 'Excellent (80%+)', value: 0.8, color: 'from-emerald-500 to-green-500' },
                                                        { label: 'Good (60%+)', value: 0.6, color: 'from-blue-500 to-cyan-500' },
                                                        { label: 'Fair (40%+)', value: 0.4, color: 'from-amber-500 to-orange-500' },
                                                        { label: 'All Jobs', value: 0.0, color: 'from-slate-500 to-slate-600' }
                                                    ].map((filter) => (
                                                        <button
                                                            key={filter.value} onClick={() => setScoreThreshold(filter.value)}
                                                            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 transform hover:scale-105 ${scoreThreshold === filter.value
                                                                    ? `bg-gradient-to-r ${filter.color} text-white shadow-lg`
                                                                    : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                                }`}
                                                        >
                                                            {filter.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-900 animate-fade-in-up">
                                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 text-center">  Email These Results</h4>
                                        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-4">
                                            <div className="relative w-full">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-950 dark:text-slate-50" />
                                                <input
                                                    type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    className="w-full pl-12 pr-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm rounded-xl border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all duration-300 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSendEmail} disabled={isSendingEmail || !userEmail.includes('@')}
                                                className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-wait disabled:transform-none disabled:hover:scale-100"
                                            >
                                                {isSendingEmail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                                <span>{isSendingEmail ? 'Sending...' : 'Send Email'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {filteredJobMatches.length === 0 ? (
                                        <div className="text-center py-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 dark:border-slate-800/50">
                                            <div className="relative inline-block mb-6">
                                                <div className="absolute inset-0 bg-amber-500 rounded-2xl blur-xl opacity-20"></div>
                                                <div className="relative p-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl">
                                                    <Filter className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                                                </div>
                                            </div>
                                            <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">No Jobs Match Your Filter</h3>
                                            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">Try lowering the minimum match score to see more results.</p>
                                            <button onClick={() => setScoreThreshold(0.0)} className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                                                Show All Jobs
                                            </button>
                                        </div>
                                    ) : (
                                        filteredJobMatches.map((job: JobMatch, index: number) => {
                                            // Debug log for each job
                                            console.log(`Processing job ${index + 1}: ${job.payload.title}`, {
                                                score: job.score,
                                                missingSkills: job.missing_skills,
                                                missingSkillsLength: job.missing_skills?.length || 0
                                            });
                                            const matchQuality = getMatchQuality(job.score);
                                            const MatchIcon = matchQuality.icon;
                                            return (
                                                <div key={job.id} className={`relative overflow-hidden ${matchQuality.bgColor} rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border group`}>
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-slate-900/20"></div>
                                                    <div className="relative p-6 lg:p-8">
                                                        <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-6 space-y-4 lg:space-y-0">
                                                            <div className="flex-1 lg:pr-8">
                                                                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4">
                                                                    <div className="flex items-center space-x-3">
                                                                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl shadow-lg">#{index + 1}</div>
                                                                        <h4 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-200 break-words flex-1">{job.payload.title}</h4>
                                                                    </div>
                                                                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium border ${matchQuality.badgeColor} w-fit`}>
                                                                        <MatchIcon className="h-4 w-4" />
                                                                        <span>{matchQuality.label}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-center lg:text-right lg:min-w-[120px]">
                                                                <div className={`text-3xl lg:text-4xl font-bold ${getScoreColor(job.score)} mb-2`}>{(job.score * 100).toFixed(1)}%</div>
                                                                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-3">Match Score</div>
                                                                <div className="w-full lg:w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                                                    <div className={`h-full transition-all duration-1000 ease-out ${getScoreBgColor(job.score)} shadow-sm`} style={{ width: `${job.score * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                                            {[
                                                                { key: 'skills', icon: Code, label: 'Skills Match', color: 'from-blue-500 to-cyan-500' },
                                                                { key: 'experience', icon: Briefcase, label: 'Experience Match', color: 'from-purple-500 to-pink-500' },
                                                                { key: 'education', icon: GraduationCap, label: 'Education Match', color: 'from-emerald-500 to-green-500' }
                                                            ].map((item) => (
                                                                <div key={item.key} className="relative overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 group">
                                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-slate-700/30"></div>
                                                                    <div className="relative text-center">
                                                                        <div className={`inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r ${item.color} rounded-xl mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                                                            <item.icon className="h-5 w-5 text-white" />
                                                                        </div>
                                                                        <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">{(job.scores_breakdown[item.key as keyof SectionScores] * 100).toFixed(0)}%</div>
                                                                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.label}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        
                                                        {/* Simple Missing Skills Display */}
                                                        <MissingSkills job={job} />

                                                        
                                                        <button onClick={() => toggleJobExpansion(job.id)} className="w-full flex items-center justify-center space-x-3 py-4 bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-700/80 backdrop-blur-sm rounded-2xl transition-all duration-300 border border-white/20 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg group">
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{expandedJob === job.id ? 'Hide Job Details' : 'View Job Description'}</span>
                                                            {expandedJob === job.id ? <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform duration-300" /> : <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform duration-300" />}
                                                        </button>
                                                    </div>
                                                    {expandedJob === job.id && (
                                                        <div className="border-t border-white/20 dark:border-slate-800/50 bg-gradient-to-br from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm p-6 lg:p-8 animate-fade-in-up">
                                                            <div className="space-y-6">
                                                                <div>
                                                                    <div className="flex items-center space-x-3 mb-4">
                                                                        <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg"><Brain className="h-5 w-5 text-white" /></div>
                                                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 text-lg">AI Scoring Analysis</h5>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                        {Object.entries(job.scores_breakdown).map(([key, score]) => (
                                                                            <div key={key} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-slate-700/50 shadow-sm">
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-slate-600 dark:text-slate-400 capitalize font-medium">{key}:</span>
                                                                                    <span className={`font-bold text-lg ${getScoreColor(score)}`}>{(score * 100).toFixed(0)}%</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <div className="flex items-center space-x-3 mb-4">
                                                                        <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl shadow-lg"><FileText className="h-5 w-5 text-white" /></div>
                                                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Complete Job Description</h5>
                                                                    </div>
                                                                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 max-h-96 overflow-y-auto border border-white/20 dark:border-slate-700/50 shadow-sm custom-scrollbar">
                                                                        <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300">
                                                                            <pre className="whitespace-pre-wrap font-sans leading-relaxed text-sm">{job.payload.description || 'Job description not available.'}</pre>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 dark:border-slate-800/50">
                                <div className="relative inline-block mb-6">
                                    <div className="absolute inset-0 bg-amber-500 rounded-2xl blur-xl opacity-20"></div>
                                    <div className="relative p-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl">
                                        <Search className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                                    </div>
                                </div>
                                <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">No Job Matches Found</h3>
                                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">No suitable job opportunities were found in our database for your profile. Try uploading a different resume or check back later.</p>
                            </div>
                        )
                    )}
                </div>
            )}
            <div className={`fixed bottom-8 right-8 z-50 transition-all duration-500 ${emailStatus !== 'idle' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                {emailStatus === 'success' && (
                    <div className="flex items-center space-x-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-2xl">
                        <CheckCircle className="h-6 w-6" />
                        <div className="font-semibold">Email sent successfully!</div>
                    </div>
                )}
                {emailStatus === 'error' && (
                    <div className="flex items-center space-x-4 p-4 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-2xl">
                        <AlertCircle className="h-6 w-6" />
                        <div className="font-semibold">Failed to send email.</div>
                    </div>
                )}
            </div>
        </>
    );
}


// --- BULK ANALYSIS VIEW COMPONENT (Unchanged) ---

function BulkAnalysisView() {
    const {
        jdFile, setJdFile, resumeFiles, setResumeFiles, isProcessing, setIsProcessing,
        error, setError, results, setResults, sortBy, setSortBy, searchQuery, setSearchQuery,
    } = useBulkAnalysis();
    
    const handleJdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].type === 'application/pdf') {
                setJdFile(e.target.files[0]);
                setError(null);
            } else {
                setError('Job Description must be a PDF file.');
                setJdFile(null);
            }
        }
    };

    const handleResumesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const pdfFiles = files.filter(file => file.type === 'application/pdf');

            if (pdfFiles.length !== files.length) {
                setError('All selected resume files must be PDFs.');
            } else {
                setError(null);
            }
            setResumeFiles((prev: File[]) => {
                const existingNames = new Set(prev.map(f => f.name));
                const newFiles = pdfFiles.filter(f => !existingNames.has(f.name));
                return [...prev, ...newFiles];
            });
        }
    };

    const handleRemoveResume = (fileName: string) => {
        setResumeFiles((prev: File[]) => prev.filter(f => f.name !== fileName));
    };
    
    const handleReset = () => {
        setJdFile(null);
        setResumeFiles([]);
        setIsProcessing(false);
        setError(null);
        setResults(null);
        setSearchQuery('');
        setSortBy('score');
    };

    const handleBulkAnalyze = async () => {
        if (!jdFile || resumeFiles.length === 0) {
            setError("Please upload one JD and at least one resume.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setResults(null);

        const formData = new FormData();
        formData.append('jd', jdFile);
        resumeFiles.forEach((file: File) => {
            formData.append('resumes', file);
        });

        try {
            const response = await fetch('http://localhost:5000/api/bulk-analyze-resumes', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const resultData = await response.json();
            setResults(resultData);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(`Analysis failed: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredAndSortedMatches = React.useMemo(() => {
        if (!results) return [];
        return results.candidate_matches
            .filter((c: CandidateMatch) => c.payload.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a: CandidateMatch, b: CandidateMatch) => {
                if (sortBy === 'score') {
                    return b.score - a.score;
                }
                return b.scores_breakdown[sortBy as keyof SectionScores] - a.scores_breakdown[sortBy as keyof SectionScores];
            });
    }, [results, searchQuery, sortBy]);

    const handleDownloadCsv = () => {
        if (!results) return;

        const headers = ["Rank", "Filename", "Overall Score (%)", "Skills Score (%)", "Experience Score (%)", "Education Score (%)", "Top Skills"];
        
        const rows = filteredAndSortedMatches.map((candidate: CandidateMatch, index: number) => [
            index + 1,
            candidate.payload.file_name,
            (candidate.score * 100).toFixed(1),
            (candidate.scores_breakdown.skills * 100).toFixed(1),
            (candidate.scores_breakdown.experience * 100).toFixed(1),
            (candidate.scores_breakdown.education * 100).toFixed(1),
            `"${candidate.payload.extracted_profile.skills.split(',').slice(0, 5).join('; ')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map((row: (string | number)[]) => row.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `TalentAlign_Analysis_${results.job_description_payload.file_name}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const ScoreBar = ({ score, colorClass }: { score: number; colorClass: string }) => (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 shadow-inner">
            <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${score * 100}%` }}></div>
        </div>
    );

    if (isProcessing) {
        return (
            <div className="max-w-3xl mx-auto mb-12 animate-fade-in-up">
                <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                    <div className="text-center">
                         <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-orange-500 rounded-2xl blur-xl opacity-30"></div>
                            <div className="relative p-4 lg:p-6 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/30 dark:to-orange-950/30 rounded-2xl">
                                <Loader2 className="h-12 w-12 lg:h-16 lg:w-16 text-red-600 dark:text-orange-400 animate-spin" />
                            </div>
                        </div>
                        <h3 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-200 mb-3">Bulk Analysis in Progress</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">Comparing {resumeFiles.length} resumes against {jdFile?.name}...</p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (results) {
        return (
             <div className="space-y-8 lg:space-y-12 animate-fade-in-up">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-white/20 dark:border-slate-800/50">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Analysis Complete</h2>
                            <p className="text-slate-600 dark:text-slate-400 mt-1">Showing {filteredAndSortedMatches.length} candidates ranked against the JD:</p>
                            <p className="font-semibold text-blue-600 dark:text-blue-400 break-all mt-2 flex items-center gap-2"><FileText size={16} /> {results.job_description_payload.file_name}</p>
                        </div>
                        <div className="flex gap-4">
                             <button
    onClick={handleDownloadCsv}
    className="flex items-center space-x-2 px-6 py-3 
          bg-gradient-to-r from-emerald-600 to-green-600 
          hover:from-emerald-700 hover:to-green-700 
          text-white font-medium rounded-2xl 
          transition-all duration-300 shadow-lg hover:shadow-xl 
          transform hover:scale-105"
>

                                <Download className="h-4 w-4" />
                                <span>Download CSV</span>
                            </button>
                            <button onClick={handleReset} className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                                <Rocket className="h-4 w-4" />
                                <span>Start New</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 mb-8 p-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="relative flex-grow">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"/>
                            <input
                                type="text"
                                placeholder="Filter by resume filename..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 
                                  text-slate-900 dark:text-white
                                  rounded-lg border-2 border-slate-300 dark:border-slate-600 
                                  focus:border-blue-500 dark:focus:border-blue-500 
                                  outline-none transition"
                            />

                        </div>
                        <div className="flex items-center flex-shrink-0 gap-2">
                             <span className="font-semibold text-slate-600 dark:text-slate-300 text-sm">Sort by:</span>
                            <div className="flex items-center p-1 bg-white/60 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setSortBy('score')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${sortBy === 'score' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Overall</button>
                                <button onClick={() => setSortBy('skills')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${sortBy === 'skills' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Skills</button>
                                <button onClick={() => setSortBy('experience')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${sortBy === 'experience' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Experience</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {filteredAndSortedMatches.map((candidate: CandidateMatch, index: number) => (
                             <div key={candidate.payload.file_name} className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden transition-all duration-300">
                                <div className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-4 mb-4">
                                                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl shadow-lg text-sm sm:text-base transition-transform duration-300 group-hover:rotate-3">
                                                    #{index + 1}
                                                </div>
                                                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-200 truncate sm:whitespace-normal">
                                                    {candidate.payload.file_name}
                                                </h3>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="p-1 rounded-lg transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <div className="flex justify-between text-xs sm:text-sm mb-1 font-medium text-slate-600 dark:text-slate-300">
                                                        <span>Skills</span>
                                                        <span>{(candidate.scores_breakdown.skills * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <ScoreBar score={candidate.scores_breakdown.skills} colorClass="bg-gradient-to-r from-blue-400 to-cyan-500"/>
                                                </div>
                                                <div className="p-1 rounded-lg transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <div className="flex justify-between text-xs sm:text-sm mb-1 font-medium text-slate-600 dark:text-slate-300">
                                                        <span>Experience</span>
                                                        <span>{(candidate.scores_breakdown.experience * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <ScoreBar score={candidate.scores_breakdown.experience} colorClass="bg-gradient-to-r from-purple-400 to-pink-500"/>
                                                </div>
                                                <div className="p-1 rounded-lg transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                    <div className="flex justify-between text-xs sm:text-sm mb-1 font-medium text-slate-600 dark:text-slate-300">
                                                        <span>Education</span>
                                                        <span>{(candidate.scores_breakdown.education * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <ScoreBar score={candidate.scores_breakdown.education} colorClass="bg-gradient-to-r from-emerald-400 to-green-500"/>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-center md:text-right w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700/50 md:pl-6">
                                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Overall Match</div>
                                            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 hover:from-orange-500 hover:to-red-500">
                                                {(candidate.score * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 lg:space-y-12 animate-fade-in-up">
            <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                    Bulk Resume Analysis
                </h2>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    Rank multiple candidates against a single job description to find the best fit instantly.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 flex items-center space-x-3 max-w-3xl mx-auto">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
                <div className="lg:col-span-3 space-y-8">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-slate-800/50">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl">
                               <Library className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">1. Upload Job Description</h3>
                                <p className="text-slate-500 dark:text-slate-400">Select one PDF file.</p>
                            </div>
                        </div>
                         <label htmlFor="jd-upload" className="w-full cursor-pointer">
                            <div className={`flex items-center space-x-4 p-4 border-2 border-dashed rounded-xl transition-all ${jdFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'}`}>
                                <Upload className="h-6 w-6 text-slate-500" />
                                <div className="truncate">
                                    <span className={`font-medium ${jdFile ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {jdFile ? jdFile.name : 'Choose a JD PDF file...'}
                                    </span>
                                </div>
                            </div>
                        </label>
                        <input type="file" id="jd-upload" accept=".pdf" onChange={handleJdSelect} className="hidden" />
                    </div>
                </div>
                
                <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-slate-800/50">
                     <div className="flex items-center space-x-4 mb-6">
                        <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-2xl">
                           <Files className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">2. Upload Resumes</h3>
                        </div>
                    </div>
                     <label htmlFor="resumes-upload" className="w-full cursor-pointer mb-4 inline-block">
                        <div className={`flex items-center justify-center space-x-4 p-4 border-2 border-dashed rounded-xl transition-all ${resumeFiles.length > 0 ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'}`}>
                            <Upload className="h-6 w-6 text-slate-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                {resumeFiles.length > 0 ? `Add more files...` : 'Choose resume PDF(s)...'}
                            </span>
                        </div>
                    </label>
                    <input type="file" id="resumes-upload" accept=".pdf" onChange={handleResumesSelect} className="hidden" multiple />
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {resumeFiles.map((file: File) => (
                            <div key={file.name} className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <FileText size={16} className="text-slate-500 flex-shrink-0"/>
                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate px-2">{file.name}</span>
                                <button onClick={() => handleRemoveResume(file.name)} className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors">
                                    <XCircle size={16}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="text-center mt-12">
                <button
                    onClick={handleBulkAnalyze}
                    disabled={isProcessing || !jdFile || resumeFiles.length === 0}
                    className="relative group inline-flex items-center px-8 lg:px-12 py-4 lg:py-5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold text-lg rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    <Sparkles className="relative h-6 w-6 mr-3" />
                    <span className="relative">Analyze ({resumeFiles.length}) Candidates</span>
                    <ArrowRight className="relative h-6 w-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
            </div>
        </div>
    );
}


// --- MAIN APP COMPONENT ---

function App() {
    const [darkMode, setDarkMode] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [view, setView] = useState<View>('candidate');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        const newDarkMode = !darkMode;
        setDarkMode(newDarkMode);
        if (newDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const resetApplication = () => {
        window.location.reload();
    };

    const renderView = () => {
        switch (view) {
            case 'candidate':
                return <CandidateView />;
            case 'admin':
                return <AdminView />;
            case 'bulk':
                return <BulkAnalysisView />;
            default:
                return <CandidateView />;
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-black dark:to-blue-950 transition-all duration-500">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-emerald-400/10 to-cyan-600/10 rounded-full blur-3xl delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-400/5 to-pink-600/5 rounded-full blur-3xl delay-500"></div>
            </div>

            <header className="relative z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-lg border-b border-white/20 dark:border-slate-800/50 sticky top-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 cursor-pointer" onClick={resetApplication}>
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-75"></div>
                                
                                <div className="relative p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-xl">
                                    <FaHandshake className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
                                </div>

                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-3xl lg:text-3xl font-bold bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">TalentAlign AI</h1>
                                <p className="text-slate-600 dark:text-slate-400 text-xs lg:text-sm font-medium">Next-Gen Resume Intelligence Platform</p>
                            </div>
                             <div className="sm:hidden">
                                <h1 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">TalentAlign AI</h1>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 lg:space-x-4">
                            <div className="hidden lg:flex items-center space-x-2 bg-white/60 dark:bg-slate-900/60 p-1 rounded-full border border-slate-200 dark:border-slate-800">
                                <button onClick={() => setView('candidate')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${view === 'candidate' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    Candidate
                                </button>
                                <button onClick={() => setView('bulk')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${view === 'bulk' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    Bulk Analysis
                                </button>
                                <button onClick={() => setView('admin')} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${view === 'admin' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                    Manage JDs
                                </button>
                            </div>

                            <button onClick={toggleDarkMode} className="relative p-3 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 shadow-lg hover:shadow-xl group" aria-label="Toggle dark mode">
                                 <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 dark:from-blue-400/20 dark:to-purple-400/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                {darkMode ? <Sun className="relative h-5 w-5 text-yellow-500 transform group-hover:rotate-180 transition-transform duration-500" /> : <Moon className="relative h-5 w-5 text-slate-600 transform group-hover:-rotate-12 transition-transform duration-500" />}
                            </button>

                            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-3 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-800 dark:hover:to-slate-700 transition-all duration-300 shadow-lg">
                                {mobileMenuOpen ? <X className="h-5 w-5 text-slate-600 dark:text-slate-400" /> : <Menu className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="lg:hidden mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 animate-fade-in-up">
                            <div className="space-y-3">
                                <button onClick={() => { setView('candidate'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium ${view === 'candidate' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Candidate View</button>
                                <button onClick={() => { setView('bulk'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium ${view === 'bulk' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Bulk Analysis</button>
                                <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg font-medium ${view === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>Manage JDs</button>
                                 <button onClick={resetApplication} className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg">
                                    <Rocket className="h-4 w-4" />
                                    <span>Start Over</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>
            
            <AdminProvider>
                <CandidateProvider>
                    <BulkAnalysisProvider>
                        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                            {renderView()}
                        </main>
                    </BulkAnalysisProvider>
                </CandidateProvider>
            </AdminProvider>
            
            <footer className="relative z-10 bg-gradient-to-r from-slate-950 via-black to-blue-950 text-white py-12 lg:py-16 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                         <div className="flex items-center justify-center space-x-4 mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-75"></div>
                                <div className="relative p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-xl">
                                    <FaHandshake className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
                                </div>
                            </div>
                            <span className="text-3xl lg:text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">TalentAlign AI</span>
                        </div>
                        <p className="text-slate-300 dark:text-slate-400 mb-6 text-lg max-w-2xl mx-auto leading-relaxed">
                            Revolutionizing recruitment with AI-powered resume analysis and intelligent job matching using OpenAI and Qdrant vector database technology.
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500">© 2025 TalentAlign AI. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;