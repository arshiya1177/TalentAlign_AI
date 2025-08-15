import React, { useState, useEffect } from 'react';
import { Loader2, Upload, Eye, Trash2 } from 'lucide-react';

interface JD {
    id: string;
    filename: string;
    uploaded_at: string;
}

const AdminViewMultiUpload: React.FC = () => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [jds, setJds] = useState<JD[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Fetch initial list
    useEffect(() => {
        const fetchJDs = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('http://localhost:5000/api/jds');
                if (!res.ok) throw new Error('Failed to fetch job descriptions');
                const data = await res.json();
                setJds(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error fetching data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchJDs();
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const pdfFiles = newFiles.filter(file => file.type === 'application/pdf');

            if (pdfFiles.length !== newFiles.length) {
                setError('Only PDF files are allowed. Non-PDF files were ignored.');
            } else {
                setError(null);
            }

            setSelectedFiles(prev => [
                ...prev,
                ...pdfFiles.filter(
                    file => !prev.some(f => f.name === file.name && f.size === file.size)
                )
            ]);
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('Please select at least one PDF file.');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('jd', file);

                const res = await fetch('http://localhost:5000/api/upload-jd', {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `Failed to upload ${file.name}`);
                }

                const newJd = await res.json();
                setJds(prevJds => [newJd, ...prevJds]);
            }

            setSelectedFiles([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown upload error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleView = (jd: JD) => {
        window.open(`http://localhost:5000/api/view-jd/${jd.id}`, '_blank');
    };

    const handleDelete = async (jd: JD) => {
        try {
            const res = await fetch(`http://localhost:5000/api/delete-jd/${jd.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error(`Failed to delete ${jd.filename}`);
            setJds(prev => prev.filter(item => item.id !== jd.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    // Pagination
    const totalPages = Math.ceil(jds.length / itemsPerPage);
    const currentItems = jds.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                Admin Dashboard
            </h2>

            {/* Upload Section */}
            <div className="flex items-center gap-4 mb-4">
                <label
                    htmlFor="jd-upload-admin"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700"
                >
                    <Upload className="w-5 h-5" />
                    Select PDFs
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
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                    {isUploading && <Loader2 className="animate-spin w-4 h-4" />}
                    Upload
                </button>
            </div>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
                <ul className="mb-4 list-disc pl-5 text-slate-700 dark:text-slate-300">
                    {selectedFiles.map(file => (
                        <li key={file.name}>{file.name}</li>
                    ))}
                </ul>
            )}

            {/* Error */}
            {error && <p className="text-red-500 mb-4">{error}</p>}

            {/* JD List */}
            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <table className="w-full border-collapse border border-slate-300 dark:border-slate-700">
                    <thead>
                        <tr className="bg-slate-200 dark:bg-slate-800">
                            <th className="border border-slate-300 dark:border-slate-700 p-2">Filename</th>
                            <th className="border border-slate-300 dark:border-slate-700 p-2">Uploaded At</th>
                            <th className="border border-slate-300 dark:border-slate-700 p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map(jd => (
                            <tr key={jd.id}>
                                <td className="border border-slate-300 dark:border-slate-700 p-2">
                                    {jd.filename}
                                </td>
                                <td className="border border-slate-300 dark:border-slate-700 p-2">
                                    {new Date(jd.uploaded_at).toLocaleString()}
                                </td>
                                <td className="border border-slate-300 dark:border-slate-700 p-2 flex gap-2">
                                    <button
                                        onClick={() => handleView(jd)}
                                        className="text-blue-500 hover:underline"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(jd)}
                                        className="text-red-500 hover:underline"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-4 gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-md ${
                                currentPage === page
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            {page}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminViewMultiUpload;
