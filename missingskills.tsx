import { useState } from "react";
import { AlertCircle, ChevronUp, ChevronDown } from "lucide-react";

type MissingSkill = { skill: string };
type Job = { missing_skills?: MissingSkill[] };

function MissingSkills({ job }: { job: Job }) {
  const [showSkills, setShowSkills] = useState(false);

  if (!job.missing_skills || job.missing_skills.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-6 p-4 rounded-2xl border transition-colors duration-300
        ${showSkills
          ? "bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800"
          : "bg-gray-50 dark:bg-slate-800/20 border-gray-200 dark:border-slate-700"}`}
    >
      {/* Entire header clickable */}
      <div
        onClick={() => setShowSkills(!showSkills)}
        className="flex items-center justify-between mb-3 cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2">
          {/* Always red icon */}
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h4
            className={`font-semibold transition-colors duration-300
              ${showSkills ? "text-red-800 dark:text-red-200" : "text-gray-700 dark:text-gray-300"}`}
          >
            Missing Skills ({job.missing_skills.length})
          </h4>
        </div>

        {showSkills ? (
          <ChevronUp className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-red-600 dark:text-red-400" />
        )}
      </div>

      {showSkills && (
        <div className="flex flex-wrap gap-2">
          {job.missing_skills.map((skill, index) => (
            <span
              key={index}
              className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
            >
              {skill.skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MissingSkills;
