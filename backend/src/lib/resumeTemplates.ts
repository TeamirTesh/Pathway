// Built-in resume templates. These are complete, compilable LaTeX documents
// (with placeholder content) that double as the style/structure reference fed
// to the model when it tailors a resume. Users can also import their own
// templates, which live in the ResumeTemplate table; those are merged with
// these at the API layer.

export interface TemplateShape {
  id: string;
  name: string;
  latexSource: string;
  builtin: boolean;
}

const JAKE = String.raw`%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}


%----------FONT OPTIONS----------
% sans-serif
% \usepackage[sfdefault]{FiraSans}
% \usepackage[sfdefault]{roboto}
% \usepackage[sfdefault]{noto-sans}
% \usepackage[default]{sourcesanspro}

% serif
% \usepackage{CormorantGaramond}
% \usepackage{charter}


\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\begin{document}

%----------HEADING----------
% \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
%   \textbf{\href{http://sourabhbajaj.com/}{\Large Sourabh Bajaj}} & Email : \href{mailto:sourabh@sourabhbajaj.com}{sourabh@sourabhbajaj.com}\\
%   \href{http://sourabhbajaj.com/}{http://www.sourabhbajaj.com} & Mobile : +1-123-456-7890 \\
% \end{tabular*}

\begin{center}
    \textbf{\Huge \scshape Jake Ryan} \\ \vspace{1pt}
    \small 123-456-7890 $|$ \href{mailto:x@x.com}{\underline{jake@su.edu}} $|$
    \href{https://linkedin.com/in/...}{\underline{linkedin.com/in/jake}} $|$
    \href{https://github.com/...}{\underline{github.com/jake}}
\end{center}


%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Southwestern University}{Georgetown, TX}
      {Bachelor of Arts in Computer Science, Minor in Business}{Aug. 2018 -- May 2021}
    \resumeSubheading
      {Blinn College}{Bryan, TX}
      {Associate's in Liberal Arts}{Aug. 2014 -- May 2018}
  \resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {Undergraduate Research Assistant}{June 2020 -- Present}
      {Texas A\&M University}{College Station, TX}
      \resumeItemListStart
        \resumeItem{Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems}
        \resumeItem{Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data}
        \resumeItem{Explored ways to visualize GitHub collaboration in a classroom setting}
      \resumeItemListEnd

% -----------Multiple Positions Heading-----------
%    \resumeSubSubheading
%     {Software Engineer I}{Oct 2014 - Sep 2016}
%     \resumeItemListStart
%        \resumeItem{Apache Beam}
%          {Apache Beam is a unified model for defining both batch and streaming data-parallel processing pipelines}
%     \resumeItemListEnd
%    \resumeSubHeadingListEnd
%-------------------------------------------

    \resumeSubheading
      {Information Technology Support Specialist}{Sep. 2018 -- Present}
      {Southwestern University}{Georgetown, TX}
      \resumeItemListStart
        \resumeItem{Communicate with managers to set up campus computers used on campus}
        \resumeItem{Assess and troubleshoot computer problems brought by students, faculty and staff}
        \resumeItem{Maintain upkeep of computers, classroom equipment, and 200 printers across campus}
    \resumeItemListEnd

    \resumeSubheading
      {Artificial Intelligence Research Assistant}{May 2019 -- July 2019}
      {Southwestern University}{Georgetown, TX}
      \resumeItemListStart
        \resumeItem{Explored methods to generate video game dungeons based off of \emph{The Legend of Zelda}}
        \resumeItem{Developed a game in Java to test the generated dungeons}
        \resumeItem{Contributed 50K+ lines of code to an established codebase via Git}
        \resumeItem{Conducted  a human subject study to determine which video game dungeon generation technique is enjoyable}
        \resumeItem{Wrote an 8-page paper and gave multiple presentations on-campus}
        \resumeItem{Presented virtually to the World Conference on Computational Intelligence}
      \resumeItemListEnd

  \resumeSubHeadingListEnd


%-----------PROJECTS-----------
\section{Projects}
    \resumeSubHeadingListStart
      \resumeProjectHeading
          {\textbf{Gitlytics} $|$ \emph{Python, Flask, React, PostgreSQL, Docker}}{June 2020 -- Present}
          \resumeItemListStart
            \resumeItem{Developed a full-stack web application using with Flask serving a REST API with React as the frontend}
            \resumeItem{Implemented GitHub OAuth to get data from user's repositories}
            \resumeItem{Visualized GitHub data to show collaboration}
            \resumeItem{Used Celery and Redis for asynchronous tasks}
          \resumeItemListEnd
      \resumeProjectHeading
          {\textbf{Simple Paintball} $|$ \emph{Spigot API, Java, Maven, TravisCI, Git}}{May 2018 -- May 2020}
          \resumeItemListStart
            \resumeItem{Developed a Minecraft server plugin to entertain kids during free time for a previous job}
            \resumeItem{Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review}
            \resumeItem{Implemented continuous delivery using TravisCI to build the plugin upon new a release}
            \resumeItem{Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin}
          \resumeItemListEnd
    \resumeSubHeadingListEnd



%
%-----------PROGRAMMING SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R} \\
     \textbf{Frameworks}{: React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI} \\
     \textbf{Developer Tools}{: Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse} \\
     \textbf{Libraries}{: pandas, NumPy, Matplotlib}
    }}
 \end{itemize}


%-------------------------------------------
\end{document}
`;

const PROGSU = String.raw`%-------------------------
% Resume in LaTeX
% Author: progsu - Joey Zhang
% Github: https://github.com/ProgClubGSU/Resume-Template-and-Guide
% Based on: https://github.com/sb2nov/resume (MIT License)
% License: MIT
%-------------------------

\documentclass[letterpaper,11pt]{article}
\usepackage{amsmath}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

% Custom tighter list environment for resume items
\newlist{resitemize}{itemize}{1}
\setlist[resitemize]{leftmargin=0.15in, topsep=3pt, partopsep=0pt, itemsep=1pt, parsep=0pt}


%----------FONT OPTIONS----------
% sans-serif
% \usepackage[sfdefault]{FiraSans}
% \usepackage[sfdefault]{roboto}
% \usepackage[sfdefault]{noto-sans}
% \usepackage[default]{sourcesanspro}

% serif
% \usepackage{CormorantGaramond}
% \usepackage{charter}


\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.7in}
\addtolength{\evensidemargin}{-0.7in}
\addtolength{\textwidth}{1.3in}
\addtolength{\topmargin}{-.7in}
\addtolength{\textheight}{1.2in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-12pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-6pt}]





% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}
% }
\newcommand{\resumeEducationCompact}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1}  \textit{\small #2}  \text{\footnotesize #3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-5pt}
}



\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} {\normalfont\small\textit{#3}} & #2 \\
    \end{tabular*}
    \ifx&#4&\else
      \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
        & \textit{\small #4} \\
      \end{tabular*}
    \fi
    \vspace{-7pt}
}


\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

%----------HEADING----------

\begin{center}
  \textbf{\huge \scshape First Last} \\ \vspace{1pt}
  \small U.S. Citizen $|$ (XXX) XXX-XXXX $|$ \href{mailto:youremail@example.com}{\underline{youremail@example.com}} $|$
  \href{https://linkedin.com/in/yourhandle}{\underline{linkedin.com/in/yourhandle}} $|$
  \href{https://github.com/yourusername}{\underline{github.com/yourusername}}
\end{center}

%-----------EDUCATION-----------
\section{Education}
\resumeSubHeadingListStart
\resumeEducationCompact
  {UNIVERSITY NAME}
  {B.S. Major, B.S./Minor in Second Discipline}
  {}
  {Month Year}

\vspace{-5pt}
\begin{itemize}[leftmargin=0.15in, label={}, topsep=2.5pt, itemsep=-4pt]
  \item[] {
    \footnotesize
    \begin{tabular*}{.985\linewidth}{@{\extracolsep{\fill}}ll}
      \textbf{Academic Awards:} Award A, Award B & \textbf{GPA:} 4.00 \\
    \end{tabular*}
  }
  \item[] {
    \vspace{2pt}
    \footnotesize
    \parbox{0.95\linewidth}{
      \textbf{Relevant Coursework:} Data Structures and Algorithms, Operating Systems, Programming Languages, Computer Organization, Discrete Mathematics, Linear Algebra, Applied Probability
    }
  }
\end{itemize}
\resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{Experience}
\resumeSubHeadingListStart

\resumeSubheading
  {Software Engineering Intern \textbar{} COMPANY NAME}{May 202X -- Aug 202X}{}{}
  \resumeItemListStart
    \resumeItem{Built and deployed internal dashboard features using React and Node.js, reducing admin processing time by 40\%}
    \resumeItem{Optimized PostgreSQL queries and RESTful API integration, decreasing latency by 60\%}
    \resumeItem{Wrote tests using Jest and Supertest to ensure 95\%+ code coverage}
  \resumeItemListEnd

\resumeSubheading
  {ROLE 2 \textbar{} COMPANY NAME}{Jan 2023 -- Present}{}{}
  \resumeItemListStart
    \resumeItem{Mentored learners in a best-selling full-stack course (1M+ students), reviewing React and Node projects and offering architectural feedback}
    \resumeItem{Debugged 200+ full-stack codebases; helped resolve async bugs, schema mismatches, and CORS issues}
    \resumeItem{Explained middleware, routing, and backend design patterns to help users move from tutorials to production builds}
  \resumeItemListEnd

\resumeSubHeadingListEnd

%-----------PROJECTS-----------
\section{Projects}
\resumeSubHeadingListStart

\resumeProjectHeading
  {PROJECT NAME \textbar{} \emph{TypeScript, React, Node.js, Firebase}
    \textnormal{\small{ -- \href{https://github.com/yourusername/your-repo}{\underline{GitHub}} \textbar{} \href{https://project-live-site.com}{\underline{Live Demo}}}}}{Month Year}
  \resumeItemListStart
    \resumeItem{Built a real-time collaborative web app using WebSockets and Firebase}
    \resumeItem{Designed a NoSQL schema with sub-100ms read latency for scalable sync}
    \resumeItem{Deployed to Google Cloud Run with zero-downtime rollouts}
  \resumeItemListEnd

\resumeProjectHeading
  {PROJECT NAME \textbar{} \emph{C, Lex/Yacc, Bytecode VM}
    \textnormal{\small{ -- \href{https://github.com/yourusername/your-repo}{\underline{GitHub}}}}}{Month Year}
  \resumeItemListStart
    \resumeItem{Created a compiled programming language with custom syntax and control flow}
    \resumeItem{Implemented a stack-based VM and AST-based compiler for interpretation}
    \resumeItem{Developed an interactive REPL for debugging and runtime experimentation}
  \resumeItemListEnd

\resumeSubHeadingListEnd


%-----------TECHNICAL SKILLS-----------
\section{Technical Skills}
\begin{itemize}[leftmargin=0.15in, label={}]
  \small{\item{
    \textbf{Languages:} JavaScript, TypeScript, Python, C++, SQL, Java, HTML/CSS \\
    \textbf{Tools/Databases:} MongoDB, PostgreSQL, Firebase, Supabase, Docker, Git, AWS, Azure, Google Cloud, Vercel \\
    \textbf{Frameworks/Libraries:} React, Node.js, Express, Flask, FastAPI, Tailwind CSS, Socket.IO
  }}
\end{itemize}

\end{document}
`;

export const BUILTIN_TEMPLATES: TemplateShape[] = [
  { id: "builtin:jake", name: "Jake's Resume", latexSource: JAKE, builtin: true },
  { id: "builtin:progsu", name: "Progsu Resume", latexSource: PROGSU, builtin: true },
];

export const DEFAULT_TEMPLATE_ID = "builtin:jake";

export function isBuiltinTemplateId(id: string): boolean {
  return id.startsWith("builtin:");
}

export function getBuiltinTemplate(id: string): TemplateShape | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
