import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';

// Importar jspdf y html2canvas
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { 
    ArrowUpTrayIcon, DocumentTextIcon, PuzzlePieceIcon, ShareIcon, LightBulbIcon, 
    UserCircleIcon, XMarkIcon, /* AcademicCapIcon, // No longer used directly here */ CheckCircleIcon, QuestionMarkCircleIcon, 
    ChatBubbleLeftRightIcon, PhotoIcon, SparklesIcon, BeakerIcon, DocumentArrowDownIcon 
} from '@heroicons/react/24/outline'; 

// Importar nuestros CSS Modules
import styles from './App.module.css'; 

// Importar el logo del cliente
import emsLogo from './assets/emslogo.png'; // Asegúrate que esta ruta sea correcta


// ** IMPORTANTE: Configuración de Firebase **
// Reemplaza esto con la configuración de TU proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB-7LgxAOw1Fh8DQYMSXTs9bWcoIKsgqLw", 
    authDomain: "tudy-spark-ai-app.firebaseapp.com",
    projectId: "study-spark-ai-app",
    storageBucket: "study-spark-ai-app.appspot.com",
    messagingSenderId: "728069876548",
    appId: "G-NPWJB081DF"
};
// Si usas el entorno de Canvas, la siguiente línea podría obtener la config automáticamente:
// const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "...", ... };


const appId = typeof __app_id !== 'undefined' ? __app_id : 'study-spark-ems-cliente';

let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    // setLogLevel('debug'); 
} catch (error) {
    console.error("Error inicializando Firebase:", error);
}

const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [images, setImages] = useState([]); 
    const [imagePreviews, setImagePreviews] = useState([]); 

    const [extractedText, setExtractedText] = useState('');
    const [isLoadingText, setIsLoadingText] = useState(false);
    
    const [isLoadingStudyAid, setIsLoadingStudyAid] = useState(false);
    const [isLoadingMindMapImage, setIsLoadingMindMapImage] = useState(false);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
    const [isLoadingExamples, setIsLoadingExamples] = useState(false);

    const [studyAidType, setStudyAidType] = useState(''); 
    const [generatedAid, setGeneratedAid] = useState(null); 
    
    const [conceptToExplain, setConceptToExplain] = useState('');
    const [explanationResult, setExplanationResult] = useState('');
    const [examplesResult, setExamplesResult] = useState('');
    const [activeFeature, setActiveFeature] = useState(''); 

    const [userProfile, setUserProfile] = useState({
        studyLevel: 'universidad', 
        language: 'es',       
    });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [currentScore, setCurrentScore] = useState(0);
    const [quizFeedback, setQuizFeedback] = useState([]);

    const fileInputRef = useRef(null);
    const exportContentRef = useRef(null); 

    // ** IMPORTANTE: Clave API de Google AI **
    const GOOGLE_AI_API_KEY = "AIzaSyCW-VsDgiC7e2Q7AYj2B73CKy-1IPODS5s"; // REEMPLAZA ESTO
    // Si el entorno Canvas la provee:
    // const GOOGLE_AI_API_KEY = typeof __google_ai_api_key !== 'undefined' ? __google_ai_api_key : "";


    useEffect(() => {
        if (!auth) {
            console.error("Firebase Auth no está inicializado.");
            setIsAuthReady(true); 
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
                await loadUserProfile(currentUser.uid);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Error en inicio de sesión anónimo/custom token:", error);
                }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        return () => {
            imagePreviews.forEach(preview => {
                if (preview.url) { 
                    URL.revokeObjectURL(preview.url);
                }
            });
        };
    }, [imagePreviews]);

    const loadUserProfile = async (uid) => {
        if (!db || !uid) return;
        const profileRef = doc(db, `artifacts/${appId}/users/${uid}/profile/settings`);
        try {
            const docSnap = await getDoc(profileRef);
            if (docSnap.exists()) {
                setUserProfile(prev => ({ ...prev, ...docSnap.data() }));
            } else {
                await saveUserProfile(uid, userProfile); 
            }
        } catch (error) {
            console.error("Error cargando perfil de usuario:", error);
        }
    };

    const saveUserProfile = async (uid, profileData) => {
        if (!db || !uid) return;
        const profileRef = doc(db, `artifacts/${appId}/users/${uid}/profile/settings`);
        try {
            await setDoc(profileRef, profileData, { merge: true });
            setUserProfile(profileData); 
            setShowProfileModal(false);
        } catch (error) {
            console.error("Error guardando perfil de usuario:", error);
        }
    };
    
    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files); 

        if (files.length > 0) {
            setImages(files); 

            const newPreviews = files.map(file => {
                let filePreviewURL = null;
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    filePreviewURL = URL.createObjectURL(file);
                }
                return {
                    type: file.type.startsWith('image/') ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'other'),
                    url: filePreviewURL,
                    name: file.name
                };
            });
            setImagePreviews(newPreviews);
            setExtractedText('');
            setGeneratedAid(null);
            setStudyAidType('');
            setExplanationResult('');
            setExamplesResult('');
            setConceptToExplain('');
            setActiveFeature('');
            setCurrentScore(0);
            setQuizFeedback([]);
        } else {
            setImages([]);
            setImagePreviews([]);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const extractTextFromImage = async () => {
        if (images.length === 0) {
            console.warn("Por favor, sube uno o más archivos primero.");
            setExtractedText("Error: No hay archivos seleccionados.");
            return;
        }
        setIsLoadingText(true);
        setExtractedText('');
        setExplanationResult('');
        setExamplesResult('');
        setActiveFeature('');

        const textPromptPart = {
            text: `Extrae el texto del(los) siguiente(s) documento(s) (puede(n) ser imagen(es) o archivo(s) PDF). El material de estudio está en idioma ${userProfile.language}. Si detectas tablas o estructuras particulares, intenta mantenerlas. Si hay varios documentos, concatena el texto extraído de cada uno en un solo bloque de texto, manteniendo un orden lógico si es posible o separando el contenido de cada documento con un delimitador claro como "--- NUEVO DOCUMENTO ---". Para archivos PDF, extrae todo el contenido textual relevante de todas sus páginas.`
        };

        try {
            const fileDataPartsPromises = images.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onloadend = () => {
                        const base64Data = reader.result.split(',')[1];
                        resolve({
                            inlineData: {
                                mimeType: file.type, 
                                data: base64Data
                            }
                        });
                    };
                    reader.onerror = (error) => {
                        console.error("Error leyendo el archivo:", file.name, error);
                        reject(new Error(`Error leyendo el archivo ${file.name}`));
                    };
                });
            });

            const resolvedFileDataParts = await Promise.all(fileDataPartsPromises);

            const payload = {
                contents: [{
                    parts: [textPromptPart, ...resolvedFileDataParts]
                }],
            };
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Error de API Gemini (extracción multi-archivo):", errorBody);
                throw new Error(`Error ${response.status}: ${errorBody.error?.message || response.statusText}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
                setExtractedText(result.candidates[0].content.parts[0].text);
            } else {
                console.warn("Respuesta inesperada de Gemini (extracción multi-archivo):", result);
                let errorMessage = "No se pudo extraer texto o la respuesta no tuvo el formato esperado.";
                if (result.promptFeedback && result.promptFeedback.blockReason) {
                    errorMessage = `Extracción bloqueada: ${result.promptFeedback.blockReason}. ${result.promptFeedback.blockReasonMessage || ''}`;
                } else if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'SAFETY') {
                    errorMessage = "La extracción de texto fue bloqueada por políticas de seguridad. Intenta con otros archivos.";
                }
                setExtractedText(errorMessage);
            }
        } catch (error) {
            console.error("Error llamando a Gemini API (extracción multi-archivo) o procesando archivos:", error);
            setExtractedText(`Error al procesar los archivos: ${error.message}. Intenta de nuevo o revisa la consola.`);
        } finally {
            setIsLoadingText(false);
        }
    };

    const generateMindMapImageFromDescription = async (description) => {
        setIsLoadingMindMapImage(true);
        setActiveFeature('');
        const imagePrompt = `Genera una imagen de un mapa mental que represente visualmente la siguiente descripción. Intenta que sea claro, organizado y visualmente atractivo. Descripción: "${description}"`;
        const payload = { 
            instances: [{ prompt: imagePrompt }],
            parameters: { "sampleCount": 1 } 
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_API_KEY}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Error de API Imagen (generación mapa mental):", errorBody);
                throw new Error(`Error ${response.status}: ${errorBody.error?.message || response.statusText}`);
            }
            const result = await response.json();

            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                setGeneratedAid(imageUrl); 
            } else {
                console.warn("Respuesta inesperada de API Imagen (mapa mental):", result);
                setGeneratedAid("No se pudo generar la imagen del mapa mental o la respuesta no fue la esperada.");
            }
        } catch (error) {
            console.error("Error llamando a API Imagen (mapa mental):", error);
            setGeneratedAid(`Error al generar imagen del mapa mental: ${error.message}.`);
        } finally {
            setIsLoadingMindMapImage(false);
        }
    };

    const generateStudyAid = async (type) => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error") || extractedText.toLowerCase().startsWith("no se pudo")) {
            console.warn("Primero extrae texto de un archivo de forma exitosa.");
            return;
        }
        setStudyAidType(type);
        setIsLoadingStudyAid(true);
        setGeneratedAid(null); 
        setExplanationResult(''); 
        setExamplesResult('');   
        setActiveFeature('');    
        setCurrentScore(0);
        setQuizFeedback([]);

        let prompt = "";
        let responseSchema = null;
        const basePrompt = `Eres un asistente de estudio experto. El usuario tiene un nivel de estudio '${userProfile.studyLevel}' y prefiere el contenido en '${userProfile.language}'.\n\nMaterial de estudio base (extraído de imágenes o PDFs):\n"""${extractedText}"""\n\n`;

        if (type === 'summary') {
            prompt = `${basePrompt}Por favor, genera un resumen conciso y claro de este material, destacando los puntos más importantes.`;
        } else if (type === 'quiz') {
            prompt = `${basePrompt}Crea un quiz interactivo de 10 preguntas de opción múltiple (con 4 opciones cada una, donde solo una es correcta) basado en el material. Para cada pregunta, indica claramente cuál es la opción correcta y proporciona una breve explicación de por qué esa respuesta es correcta.`;
            responseSchema = { 
                type: "ARRAY", description: "Un array de objetos, cada uno representando una pregunta del quiz.",
                items: {
                    type: "OBJECT", properties: {
                        question: { type: "STRING", description: "La pregunta del quiz." },
                        options: { type: "ARRAY", description: "Un array de 4 strings, representando las opciones de respuesta.", items: { type: "STRING" } },
                        correctAnswerIndex: { type: "INTEGER", description: "El índice (0-3) de la opción correcta en el array 'options'." },
                        explanation: { type: "STRING", description: "Una breve explicación de por qué la respuesta correcta es correcta."}
                    }, required: ["question", "options", "correctAnswerIndex", "explanation"]
                }
            };
        } else if (type === 'faq') {
            prompt = `${basePrompt}Genera una guía de estudio en formato de Preguntas Frecuentes (FAQ). Crea al menos 10 preguntas clave que un estudiante podría tener sobre este material, junto con sus respuestas concisas y claras.`;
            responseSchema = {
                type: "ARRAY",
                description: "Un array de objetos, cada uno representando una pregunta y su respuesta.",
                items: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING", description: "La pregunta de estudio." },
                        answer: { type: "STRING", description: "La respuesta a la pregunta." }
                    },
                    required: ["question", "answer"]
                }
            };
        } else if (type === 'mindmap_description') { 
            prompt = `${basePrompt}Describe detalladamente la estructura y contenido de un mapa mental basado en este material. Identifica el concepto central, los temas principales que se ramifican de él, y los subtemas o ideas clave para cada tema principal. Especifica las relaciones entre los conceptos. Esta descripción se usará para generar una imagen del mapa mental, así que sé muy específico sobre la jerarquía y las conexiones.`;
        }

        const apiPayload = { 
            contents: [{ parts: [{ text: prompt }] }],
            ...(responseSchema && { 
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            })
        };
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error(`Error de API Gemini (generación ${type}):`, errorBody);
                throw new Error(`Error ${response.status}: ${errorBody.error?.message || response.statusText}`);
            }
            
            const result = await response.json();
            let aidData;

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
                
                aidData = result.candidates[0].content.parts[0].text;

                if (type === 'mindmap_description') { 
                    setIsLoadingStudyAid(false); 
                    await generateMindMapImageFromDescription(aidData);
                    return; 
                }

                if (responseSchema) { 
                    try {
                        aidData = JSON.parse(aidData);
                    } catch (e) {
                        console.error("Error parseando JSON de Gemini:", e, "Respuesta original:", aidData);
                        setGeneratedAid(`Error: La IA devolvió un texto que no es JSON válido para ${type}, aunque se esperaba. Contenido: ${aidData}`);
                        setIsLoadingStudyAid(false);
                        return; 
                    }
                }
                setGeneratedAid(aidData);

                if (db && userId) { 
                    try {
                        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/studyAids`), {
                            originalFileNames: images.length > 0 ? images.map(img => img.name).join(', ') : 'Desconocido',
                            extractedText: extractedText.substring(0, 1000), 
                            aidType: type,
                            generatedAidOrDescription: typeof aidData === 'string' ? aidData.substring(0,1000) : aidData, 
                            studyLevel: userProfile.studyLevel,
                            language: userProfile.language,
                            createdAt: serverTimestamp(),
                            promptUsed: prompt.substring(0,1000) 
                        });
                    } catch (firestoreError) {
                        console.warn("Error guardando ayuda de estudio en Firestore:", firestoreError);
                    }
                }

            } else { 
                console.warn(`Respuesta inesperada de Gemini (generación ${type}):`, result);
                let errorMessage = `No se pudo generar ${type} o la respuesta no tuvo el formato esperado.`;
                if (result.promptFeedback && result.promptFeedback.blockReason) {
                    errorMessage = `Generación de ${type} bloqueada: ${result.promptFeedback.blockReason}. ${result.promptFeedback.blockReasonMessage || ''}`;
                }
                setGeneratedAid(errorMessage);
            }

        } catch (error) { 
            console.error(`Error llamando a Gemini API (generación ${type}):`, error);
            setGeneratedAid(`Error al generar ${type}: ${error.message}. Intenta de nuevo o revisa la consola.`);
        }
        finally {
            if (type !== 'mindmap_description') { 
                setIsLoadingStudyAid(false);
            }
        }
    };

    const explainKeyConcept = async () => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error")) {
            setExplanationResult("Primero extrae texto de una imagen de forma exitosa.");
            return;
        }
        if (!conceptToExplain.trim()) {
            setExplanationResult("Por favor, ingresa un concepto para explicar.");
            return;
        }
        setIsLoadingExplanation(true);
        setExplanationResult('');
        setGeneratedAid(null); 
        setExamplesResult(''); 
        setActiveFeature('explanation');

        const prompt = `Eres un profesor experto. Basado en el siguiente material de estudio, explica el concepto clave "${conceptToExplain}" de forma clara y concisa. Adapta la explicación para un nivel de estudio '${userProfile.studyLevel}' y en idioma '${userProfile.language}'.\n\nMaterial de estudio:\n"""${extractedText}"""\n\nExplicación del concepto "${conceptToExplain}":`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const errorBody = await response.json(); throw new Error(`Error ${response.status}: ${errorBody.error?.message || response.statusText}`);}
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setExplanationResult(result.candidates[0].content.parts[0].text);
            } else {
                setExplanationResult("No se pudo generar la explicación para este concepto.");
            }
        } catch (error) {
            console.error("Error API (explicación concepto):", error);
            setExplanationResult(`Error al generar explicación: ${error.message}.`);
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const generatePracticalExamples = async () => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error")) {
            setExamplesResult("Primero extrae texto de una imagen de forma exitosa.");
            return;
        }
        setIsLoadingExamples(true);
        setExamplesResult('');
        setGeneratedAid(null); 
        setExplanationResult(''); 
        setActiveFeature('examples');

        const prompt = `Eres un educador creativo. Basado en el siguiente material de estudio, genera 2-3 ejemplos prácticos o aplicaciones del mundo real de los conceptos principales discutidos. Haz que los ejemplos sean relevantes para un nivel de estudio '${userProfile.studyLevel}' y en idioma '${userProfile.language}'.\n\nMaterial de estudio:\n"""${extractedText}"""\n\nEjemplos Prácticos:`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const errorBody = await response.json(); throw new Error(`Error ${response.status}: ${errorBody.error?.message || response.statusText}`);}
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setExamplesResult(result.candidates[0].content.parts[0].text);
            } else {
                setExamplesResult("No se pudieron generar ejemplos prácticos para este material.");
            }
        } catch (error) {
            console.error("Error API (generar ejemplos):", error);
            setExamplesResult(`Error al generar ejemplos: ${error.message}.`);
        } finally {
            setIsLoadingExamples(false);
        }
    };

    const handleExportToPDF = async () => {
        const input = exportContentRef.current;
        if (!input) {
            console.error("Elemento para exportar no encontrado.");
            return;
        }

        // Las librerías jsPDF y html2canvas ya están importadas al principio del archivo.
        try {
            input.classList.add(styles.pdfExportArea);
            const canvas = await html2canvas(input, {
                scale: 2, 
                useCORS: true, 
                logging: false, 
                backgroundColor: '#ffffff', 
            });
            input.classList.remove(styles.pdfExportArea); 
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p', 
                unit: 'px', 
                format: [canvas.width, canvas.height] 
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`StudySpark_Resultados_${studyAidType || activeFeature || 'export'}.pdf`);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            alert("Hubo un error al generar el PDF."); 
            if (input) input.classList.remove(styles.pdfExportArea); 
        }
    };

    const handleQuizAnswer = (questionIndex, selectedOptionIndex) => { 
        if (!generatedAid || !Array.isArray(generatedAid) || !generatedAid[questionIndex]) return;
        const correctAnswerIndex = generatedAid[questionIndex].correctAnswerIndex;
        const isCorrect = selectedOptionIndex === correctAnswerIndex;
        setQuizFeedback(prev => {
            const newFeedback = [...prev];
            newFeedback[questionIndex] = { questionIndex, correct: isCorrect, userAnswer: selectedOptionIndex, correctAnswer: correctAnswerIndex };
            return newFeedback;
        });
        if (isCorrect) { setCurrentScore(prev => prev + 1); }
    };

    const handleProfileChange = (e) => { 
        const { name, value } = e.target;
        setUserProfile(prev => ({ ...prev, [name]: value }));
    };

    const submitProfile = () => { 
        if (userId) {
            saveUserProfile(userId, userProfile);
        }
    };

    if (!isAuthReady) { 
        return (
            <div className={styles.loadingAuthContainer}> 
                <div className={styles.spinner}></div>
                <p className={styles.loadingAuthText}>Autenticando...</p>
            </div>
        );
    }
    
    const FaqDisplay = ({ data }) => { 
        if (!Array.isArray(data)) return <p className={styles.resultContentError}>Error en datos de FAQ.</p>;
        if (data.length === 0) return <p className={styles.noResultsText}>No se generaron preguntas y respuestas.</p>;
        return (
            <div className={styles.faqContainer}> 
                {data.map((item, index) => (
                    <details key={index} className={styles.faqItem} open> 
                        <summary className={styles.faqQuestion}>
                            {index + 1}. {item.question}
                        </summary>
                        <p className={styles.faqAnswer}>{item.answer}</p>
                    </details>
                ))}
            </div>
        );
    };
    const MindMapImageDisplay = ({ imageUrl }) => { 
        if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.toLowerCase().startsWith("error") || imageUrl.toLowerCase().startsWith("no se pudo")) {
             return <p className={styles.resultContentError}>{imageUrl || "No se pudo cargar la imagen del mapa mental."}</p>;
        }
        return (
            <div className={styles.mindMapImageContainer}> 
                <img src={imageUrl} alt="Mapa Mental Generado por IA" className={styles.mindMapImage} />
                <p className={styles.mindMapImageCaption}>La calidad y contenido de la imagen dependen de la IA.</p>
            </div>
        );
    };

    // Componente para el Título con el nuevo logo EMS
    const AppTitleHeader = () => (
        <div className={styles.appTitleHeaderContainer}> 
            <img src={emsLogo} alt="EMS Logo" className={styles.appLogo} />
            {/* Si quieres añadir texto junto al logo, puedes hacerlo aquí o quitar el h1 de abajo */}
            {/* <h1 className={styles.mainTitle}>EMS Study Aid</h1> */}
        </div>
    );


    return (
        <div className={styles.appContainer}>
            <header className={styles.appHeader}>
                 <div className={styles.headerInfo}>
                    <div>
                        {userId ? `ID Usuario: ${userId.substring(0,10)}...` : 'Modo Anónimo'}
                    </div>
                    <button
                        onClick={() => setShowProfileModal(true)}
                        className={styles.profileButton}
                        title="Perfil de Usuario"
                    >
                        <UserCircleIcon className={styles.profileIcon} />
                    </button>
                </div>
                <AppTitleHeader /> 
                <p className={styles.mainTitle}>Escuela Modelo Sarmiento estudia con IA.</p>
            </header>

            {showProfileModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>Perfil de Estudio</h2>
                            <button onClick={() => setShowProfileModal(false)} className={styles.modalCloseButton}>
                                <XMarkIcon style={{height: '1.5rem', width: '1.5rem'}}/>
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div>
                                <label htmlFor="studyLevel">Nivel de Estudio:</label>
                                <select
                                    id="studyLevel"
                                    name="studyLevel"
                                    value={userProfile.studyLevel}
                                    onChange={handleProfileChange}
                                    className={styles.modalSelect}
                                >
                                    <option value="primaria">Primaria</option>
                                    <option value="secundaria">Secundaria</option>
                                    <option value="universidad">Universidad</option>
                                    <option value="profesional">Profesional</option>
                                    <option value="autodidacta">Autodidacta (General)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="language">Idioma Preferido (para IA):</label>
                                <select
                                    id="language"
                                    name="language"
                                    value={userProfile.language}
                                    onChange={handleProfileChange}
                                    className={styles.modalSelect}
                                >
                                    <option value="es">Español</option>
                                    <option value="en">Inglés</option>
                                    <option value="pt">Portugués</option>
                                    <option value="fr">Francés</option>
                                </select>
                            </div>
                            <button
                                onClick={submitProfile}
                                className={`${styles.modalButton} ${styles.button}`}
                            >
                                <CheckCircleIcon /> Guardar Perfil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className={styles.mainContent}>
                <section className={styles.section}>
                     <h2 className={styles.sectionTitle}>1. Sube tus Archivos de Estudio</h2>
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, application/pdf"
                        multiple 
                        onChange={handleImageUpload}
                        ref={fileInputRef}
                        style={{ display: 'none' }} 
                    />
                    <button onClick={triggerFileInput} className={styles.fileInputButton}>
                        <ArrowUpTrayIcon /> 
                        <span>Seleccionar Archivos (Imágenes o PDF)</span>
                    </button>

                    {imagePreviews.length > 0 && (
                        <div className={styles.imagePreviewContainer}>
                            <h3 className={styles.imagePreviewTitle}>
                                Vista Previa ({imagePreviews.length} {imagePreviews.length === 1 ? "archivo" : "archivos"}):
                            </h3>
                            <div className={styles.previewGrid}> 
                                {imagePreviews.map((preview, index) => (
                                    <div key={index} title={preview.name} className={styles.previewItem}>
                                        {preview.type === 'image' && preview.url ? (
                                            <img
                                                src={preview.url}
                                                alt={`Vista previa ${preview.name}`}
                                                className={styles.previewImage}
                                            />
                                        ) : preview.type === 'pdf' ? (
                                            <div className={styles.previewIconContainer_Pdf}>
                                                <DocumentTextIcon className={styles.previewPdfIcon} />
                                            </div>
                                        ) : (
                                            <div className={styles.previewIconContainer_Other}>
                                                <QuestionMarkCircleIcon className={styles.previewOtherIcon} />
                                            </div>
                                        )}
                                        <p className={styles.previewFileName}>
                                            {preview.name}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={extractTextFromImage}
                                disabled={isLoadingText || images.length === 0}
                                className={`${styles.buttonGreen} ${styles.button}`}
                                style={{ marginTop: '1rem', marginLeft: 'auto', marginRight: 'auto' }}
                            >
                                {isLoadingText ? (
                                    <> <div className={styles.spinnerSmall}></div> Procesando Archivos... </>
                                ) : (
                                    <> <DocumentTextIcon /> Procesar {images.length > 1 ? `${images.length} Archivos` : 'Archivo'} </>
                                )}
                            </button>
                        </div>
                    )}
                </section>

                {extractedText && !isLoadingText && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. Texto Extraído</h2>
                        <div className={extractedText.toLowerCase().startsWith("error") || extractedText.toLowerCase().startsWith("no se pudo") ? styles.extractedTextError : styles.extractedTextContainer}>
                            <p>{extractedText}</p>
                        </div>
                    </section>
                )}
                
                {extractedText && !isLoadingText && !extractedText.toLowerCase().startsWith("error") && !extractedText.toLowerCase().startsWith("no se pudo") && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>3. Elige tu Herramienta de Repaso Principal</h2>
                        <div className={styles.toolButtonGrid}>
                            <button onClick={() => generateStudyAid('summary')} disabled={isLoadingStudyAid || isLoadingMindMapImage || isLoadingExplanation || isLoadingExamples} className={`${styles.buttonBlue} ${styles.button}`}> <LightBulbIcon /> Resumen </button>
                            <button onClick={() => generateStudyAid('quiz')} disabled={isLoadingStudyAid || isLoadingMindMapImage || isLoadingExplanation || isLoadingExamples} className={`${styles.buttonPurple} ${styles.button}`}> <PuzzlePieceIcon /> Quiz </button>
                            <button onClick={() => generateStudyAid('faq')} disabled={isLoadingStudyAid || isLoadingMindMapImage || isLoadingExplanation || isLoadingExamples} className={`${styles.buttonIndigo} ${styles.button}`}> <ChatBubbleLeftRightIcon /> FAQ Guía </button>
                            <button onClick={() => generateStudyAid('mindmap_description')} disabled={isLoadingStudyAid || isLoadingMindMapImage || isLoadingExplanation || isLoadingExamples} className={`${styles.buttonTeal} ${styles.button}`}> <PhotoIcon /> Mapa Mental (Img) </button>
                        </div>
                    </section>
                )}

                {extractedText && !isLoadingText && !extractedText.toLowerCase().startsWith("error") && !extractedText.toLowerCase().startsWith("no se pudo") && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>✨ Herramientas IA Adicionales</h2>
                        <div className={styles.conceptInputContainer} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                            <div>
                                <label htmlFor="conceptInput">Explorar un concepto del texto:</label>
                                <div className={styles.conceptInputGroup}>
                                    <input type="text" id="conceptInput" value={conceptToExplain} onChange={(e) => setConceptToExplain(e.target.value)} placeholder="Escribe un concepto o término..." className={styles.conceptInput} />
                                    <button onClick={explainKeyConcept} disabled={isLoadingExplanation || !conceptToExplain.trim()} className={`${styles.buttonCyan} ${styles.button}`}>
                                        {isLoadingExplanation ? <div className={styles.spinnerSmall}></div> : <SparklesIcon />} <span style={{marginLeft: '0.5rem'}}>Explicar</span>
                                    </button>
                                </div>
                            </div>
                            <button onClick={generatePracticalExamples} disabled={isLoadingExamples} className={`${styles.buttonLime} ${styles.button}`}>
                                {isLoadingExamples ? <div className={styles.spinnerSmall} style={{marginRight: '0.5rem'}}></div> : <BeakerIcon />} Generar Ejemplos Prácticos
                            </button>
                        </div>
                    </section>
                )}
                
                {(isLoadingStudyAid || isLoadingMindMapImage || isLoadingExplanation || isLoadingExamples ) && 
                 !((activeFeature === 'explanation' && isLoadingExplanation) || (activeFeature === 'examples' && isLoadingExamples) || (studyAidType && (isLoadingStudyAid || isLoadingMindMapImage))) && (
                    <div className={styles.loadingIndicatorContainer}>
                        <div className={styles.spinner}></div>
                        <p className={styles.loadingText}>
                            {isLoadingMindMapImage ? "Generando imagen del mapa mental con IA..." : 
                             isLoadingExplanation ? "Explicando concepto..." :
                             isLoadingExamples ? "Generando ejemplos..." :
                             "Generando ayuda de estudio con IA..."}
                        </p>
                    </div>
                )}

                 {((!isLoadingStudyAid && !isLoadingMindMapImage && generatedAid) || 
                   (!isLoadingExplanation && explanationResult) || 
                   (!isLoadingExamples && examplesResult)) && (
                    <section className={styles.section}>
                        <div ref={exportContentRef} className={styles.resultsDisplayContainer}> 
                            {activeFeature === 'explanation' && explanationResult && (
                                 <>
                                    <h2 className={styles.sectionSubTitle}>✨ Explicación del Concepto: <span style={{color: 'var(--client-celeste)'}}>{conceptToExplain}</span></h2>
                                    <div className={styles.resultContent}>
                                        {explanationResult}
                                    </div>
                                </>
                            )}
                            {isLoadingExplanation && activeFeature === 'explanation' && (
                                <div className={styles.loadingIndicatorContainer} style={{padding: '1.5rem', backgroundColor: 'transparent', boxShadow: 'none'}}>
                                    <div className={styles.spinner} style={{borderColor: 'var(--client-celeste)', height: '2rem', width: '2rem'}}></div>
                                    <p className={styles.loadingText} style={{fontSize: '1.125rem', color: 'var(--client-celeste)'}}>Explicando concepto...</p>
                                </div>
                            )}

                            {activeFeature === 'examples' && examplesResult && (
                                 <>
                                    <h2 className={styles.sectionSubTitle}>✨ Ejemplos Prácticos</h2>
                                    <div className={styles.resultContent}>
                                        {examplesResult}
                                    </div>
                                </>
                            )}
                             {isLoadingExamples && activeFeature === 'examples' && (
                                <div className={styles.loadingIndicatorContainer} style={{padding: '1.5rem', backgroundColor: 'transparent', boxShadow: 'none'}}>
                                    <div className={styles.spinner} style={{borderColor: 'var(--client-orange)', height: '2rem', width: '2rem'}}></div>
                                    <p className={styles.loadingText} style={{fontSize: '1.125rem', color: 'var(--client-orange)'}}>Generando ejemplos...</p>
                                </div>
                            )}

                            {generatedAid && !activeFeature && (
                                <>
                                    <h2 className={styles.sectionSubTitle}>
                                        {studyAidType === 'summary' && 'Resumen Generado por IA'}
                                        {studyAidType === 'quiz' && 'Quiz Interactivo (IA)'}
                                        {studyAidType === 'faq' && 'FAQ Guía de Estudio (IA)'}
                                        {studyAidType === 'mindmap_description' && 'Mapa Mental (Imagen IA)'}
                                    </h2>
                                    {studyAidType === 'summary' && typeof generatedAid === 'string' && ( <div className={styles.resultContent}> <p>{generatedAid}</p> </div> )}
                                    {studyAidType === 'quiz' && Array.isArray(generatedAid) && ( 
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                                            {generatedAid.map((item, index) => (
                                                <div key={index} className={styles.quizItem}>
                                                    <p className={styles.quizQuestion}>{index + 1}. {item.question}</p>
                                                    <div className={styles.quizOptionsContainer}>
                                                        {item.options && item.options.map((option, optIndex) => (
                                                            <button
                                                                key={optIndex}
                                                                onClick={() => handleQuizAnswer(index, optIndex)}
                                                                disabled={quizFeedback[index] !== undefined}
                                                                className={`${styles.quizOptionButton} 
                                                                    ${quizFeedback[index]?.userAnswer === optIndex ? 
                                                                        (quizFeedback[index]?.correct ? styles.quizOptionButtonCorrect : styles.quizOptionButtonIncorrect) : 
                                                                        ''}`}
                                                            >
                                                                {String.fromCharCode(65 + optIndex)}. {option}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {quizFeedback[index] !== undefined && (
                                                        <div className={`${styles.quizFeedback} ${quizFeedback[index].correct ? styles.quizFeedbackCorrect : styles.quizFeedbackIncorrect}`}>
                                                            {quizFeedback[index].correct ? 
                                                                `¡Correcto! ${item.explanation || ''}` : 
                                                                `Incorrecto. La respuesta correcta era la opción ${String.fromCharCode(65 + item.correctAnswerIndex)}. ${item.explanation || ''}`
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {quizFeedback.length > 0 && quizFeedback.length === generatedAid.length && (
                                                 <div className={styles.quizCompleted}>
                                                    <h3 className={styles.quizCompletedTitle}>Quiz Completado</h3>
                                                    <p className={styles.quizCompletedScore}>Puntuación: {currentScore} / {generatedAid.length}</p>
                                                    <button
                                                        onClick={() => setShowShareModal(true)}
                                                        className={`${styles.quizShareButton} ${styles.button}`}
                                                    >
                                                        <ShareIcon /> Compartir Resultado (Simulado)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                     )}
                                    {studyAidType === 'faq' && <FaqDisplay data={generatedAid} />}
                                    {studyAidType === 'mindmap_description' && <MindMapImageDisplay imageUrl={generatedAid} />}
                                    {typeof generatedAid === 'string' && (generatedAid.toLowerCase().includes("error") || generatedAid.toLowerCase().includes("no se pudo")) && studyAidType !== 'summary' && studyAidType !== 'mindmap_description' && ( <div className={styles.resultContentError}> <p style={{fontWeight: '600', marginBottom: '0.25rem'}}>Respuesta de IA:</p> <p>{generatedAid}</p> </div> )}
                                </>
                            )}
                        </div> 

                        {((generatedAid && !activeFeature && !isLoadingStudyAid && !isLoadingMindMapImage) || (activeFeature === 'explanation' && explanationResult && !isLoadingExplanation) || (activeFeature === 'examples' && examplesResult && !isLoadingExamples)) ? (
                            <div style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'center'}}>
                                <button
                                    onClick={handleExportToPDF}
                                    className={`${styles.buttonRed} ${styles.button}`}
                                >
                                    <DocumentArrowDownIcon />
                                    Exportar a PDF
                                </button>
                            </div>
                        ) : null}
                    </section>
                )}
            </main>

            {showShareModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.shareModalContent}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.shareModalTitle}>Compartir (Simulación)</h2>
                             <button onClick={() => setShowShareModal(false)} className={styles.modalCloseButton}>
                                <XMarkIcon style={{height: '1.5rem', width: '1.5rem'}} />
                            </button>
                        </div>
                        <p className={styles.shareModalText}>¡Comparte tus logros o materiales de estudio!</p>
                        <div className={styles.shareModalButtonsContainer}>
                            <button className={styles.shareModalButtonEmail}>Email</button>
                            <button className={styles.shareModalButtonWhatsapp}>WhatsApp</button>
                            <button className={styles.shareModalButtonSocial}>Redes Sociales</button>
                        </div>
                         <p className={styles.shareModalFooterText}>Esta es una función simulada.</p>
                    </div>
                </div>
            )}

            <footer className={styles.appFooter}>
                <p>&copy; {new Date().getFullYear()} StudySpark AI</p>
                <p className={styles.appFooterSmallText}>by: Marcos Toselli</p>
                <p className={styles.appFooterSmallText}>version - beta estado de prueba -</p>
            </footer>
        </div>
    );
};

export default App;
