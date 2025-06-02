import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';

// Importar jspdf y html2canvas
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import {
    ArrowUpTrayIcon, DocumentTextIcon, PuzzlePieceIcon, ShareIcon, LightBulbIcon,
    UserCircleIcon, XMarkIcon, AcademicCapIcon, CheckCircleIcon, QuestionMarkCircleIcon,
    ChatBubbleLeftRightIcon, PhotoIcon, SparklesIcon, BeakerIcon, DocumentArrowDownIcon,
    ArrowLeftOnRectangleIcon,
    UserPlusIcon
} from '@heroicons/react/24/outline';

// Importar nuestros CSS Modules
import styles from './App.module.css';


// ** IMPORTANTE: Configuración de Firebase **
// Reemplaza esto con la configuración de TU proyecto Firebase
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyB-7LgxAOw1Fh8DQYMSXTs9bWcoIKsgqLw", 
    authDomain: "study-spark-ai-app.firebaseapp.com",
    projectId: "study-spark-ai-app",
    storageBucket: "study-spark-ai-app.appspot.com",
    messagingSenderId: "728069876548",
    appId: "G-NPWJB081DF"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'study-spark-ai-css-modules';

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

    // --- ESTADOS PARA LOGIN/REGISTRO ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);

    // --- ESTADOS DE LA APLICACIÓN ---
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
        studyLevel: 'primaria',
        language: 'es',
    });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [currentScore, setCurrentScore] = useState(0);
    const [quizFeedback, setQuizFeedback] = useState([]);

    const fileInputRef = useRef(null);
    const exportContentRef = useRef(null);

    // REEMPLAZA ESTO CON TU CLAVE API REAL DE GOOGLE AI STUDIO
    const GOOGLE_AI_API_KEY = "AIzaSyCW-VsDgiC7e2Q7AYj2B73CKy-1IPODS5s";

    // Efecto para manejar el estado de autenticación
    useEffect(() => {
        if (!auth) {
            console.error("Firebase Auth no está inicializado.");
            setIsAuthReady(true);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setIsLoadingAuth(false);
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
                await loadUserProfile(currentUser.uid);
                setAuthError('');
                setEmail('');
                setPassword('');
            } else {
                setUser(null);
                setUserId(null);
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // Efecto para limpiar Object URLs de las vistas previas de imágenes
    useEffect(() => {
        return () => {
            imagePreviews.forEach(preview => {
                if (preview.url) {
                    URL.revokeObjectURL(preview.url);
                }
            });
        };
    }, [imagePreviews]);

    // Cargar perfil de usuario desde Firestore
    const loadUserProfile = async (uid) => {
        if (!db || !uid) return;
        const profileRef = doc(db, `artifacts/${appId}/users/${uid}/profile/settings`);
        try {
            const docSnap = await getDoc(profileRef);
            if (docSnap.exists()) {
                setUserProfile(prev => ({ ...prev, ...docSnap.data() }));
            }
        } catch (error) {
            console.error("Error cargando perfil de usuario:", error);
        }
    };

    // Guardar perfil de usuario en Firestore
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

    // Manejar registro de nuevo usuario
    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setAuthError("Por favor, ingresa email y contraseña.");
            return;
        }
        setIsLoadingAuth(true);
        setAuthError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error en registro:", error);
            setAuthError(error.message.replace('Firebase: ', ''));
            setIsLoadingAuth(false);
        }
    };

    // Manejar inicio de sesión
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setAuthError("Por favor, ingresa email y contraseña.");
            return;
        }
        setIsLoadingAuth(true);
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error en inicio de sesión:", error);
            setAuthError(error.message.replace('Firebase: ', ''));
            setIsLoadingAuth(false);
        }
    };

    // Manejar cierre de sesión
    const handleLogout = async () => {
        setIsLoadingAuth(true);
        setAuthError('');
        try {
            await signOut(auth);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error en cierre de sesión:", error);
            setAuthError(error.message.replace('Firebase: ', ''));
            setIsLoadingAuth(false);
        }
    };

    // Manejar subida de archivos
    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setImages(files);
            const newPreviews = files.map(file => ({
                type: file.type.startsWith('image/') ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'other'),
                url: (file.type.startsWith('image/') || file.type === 'application/pdf') ? URL.createObjectURL(file) : null,
                name: file.name
            }));
            setImagePreviews(newPreviews);
            setExtractedText('');
            setGeneratedAid(null);
            // ... (resetear otros estados relevantes)
        } else {
            setImages([]);
            setImagePreviews([]);
        }
    };

    // Activar input de archivo
    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    // Extraer texto de imagen/PDF usando Gemini
    const extractTextFromImage = async () => {
        if (images.length === 0) {
            setExtractedText("Error: No hay archivos seleccionados.");
            return;
        }
        setIsLoadingText(true);
        setExtractedText('');
        // ... (resetear otros estados)
        const textPromptPart = { text: `Extrae el texto del(los) siguiente(s) documento(s)... (tu prompt completo)` };
        try {
            const fileDataPartsPromises = images.map(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => resolve({ inlineData: { mimeType: file.type, data: reader.result.split(',')[1] } });
                reader.onerror = error => reject(new Error(`Error leyendo ${file.name}`));
            }));
            const resolvedFileDataParts = await Promise.all(fileDataPartsPromises);
            const payload = { contents: [{ parts: [textPromptPart, ...resolvedFileDataParts] }] };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const err = await response.json(); throw new Error(`API Error ${response.status}: ${err.error?.message || response.statusText}`); }
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setExtractedText(result.candidates[0].content.parts[0].text);
            } else {
                // ... (manejo de respuesta inesperada/bloqueo)
                setExtractedText("No se pudo extraer texto o la respuesta no tuvo el formato esperado.");
            }
        } catch (error) {
            console.error("Error en extractTextFromImage:", error);
            setExtractedText(`Error al procesar: ${error.message}.`);
        } finally {
            setIsLoadingText(false);
        }
    };

    // Generar imagen de mapa mental con Imagen
    const generateMindMapImageFromDescription = async (description) => {
        setIsLoadingMindMapImage(true);
        setActiveFeature(''); // O 'mindmap_image' si prefieres
        const imagePrompt = `Genera una imagen de un mapa mental... Descripción: "${description}"`;
        const payload = { instances: [{ prompt: imagePrompt }], parameters: { "sampleCount": 1 } };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_API_KEY}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const err = await response.json(); throw new Error(`API Error ${response.status}: ${err.error?.message || response.statusText}`); }
            const result = await response.json();
            if (result.predictions?.[0]?.bytesBase64Encoded) {
                setGeneratedAid(`data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`);
            } else {
                setGeneratedAid("No se pudo generar la imagen del mapa mental.");
            }
        } catch (error) {
            console.error("Error en generateMindMapImageFromDescription:", error);
            setGeneratedAid(`Error al generar imagen: ${error.message}.`);
        } finally {
            setIsLoadingMindMapImage(false);
        }
    };

    // Generar ayuda de estudio (resumen, quiz, FAQ) con Gemini
    const generateStudyAid = async (type) => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error")) return;
        setStudyAidType(type);
        setIsLoadingStudyAid(true);
        // ... (resetear estados)
        let prompt = "";
        let responseSchema = null;
        const basePrompt = `Eres un asistente... Material de estudio:\n"""${extractedText}"""\n\n`;
        if (type === 'summary') { /* ... tu prompt ... */ }
        else if (type === 'quiz') { /* ... tu prompt y responseSchema ... */ }
        else if (type === 'faq') { /* ... tu prompt y responseSchema ... */ }
        else if (type === 'mindmap_description') { /* ... tu prompt ... */ }

        const apiPayload = { contents: [{ parts: [{ text: prompt }] }], ...(responseSchema && { generationConfig: { responseMimeType: "application/json", responseSchema } }) };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiPayload) });
            if (!response.ok) { const err = await response.json(); throw new Error(`API Error ${response.status}: ${err.error?.message || response.statusText}`); }
            const result = await response.json();
            let aidData = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aidData) {
                if (type === 'mindmap_description') { setIsLoadingStudyAid(false); await generateMindMapImageFromDescription(aidData); return; }
                if (responseSchema) { try { aidData = JSON.parse(aidData); } catch (e) { /* ... manejo de error JSON ... */ setGeneratedAid(`Error: IA devolvió texto no JSON.`); setIsLoadingStudyAid(false); return; } }
                setGeneratedAid(aidData);
                // ... (guardar en Firestore opcional)
            } else {
                // ... (manejo de respuesta inesperada/bloqueo)
                setGeneratedAid(`No se pudo generar ${type}.`);
            }
        } catch (error) {
            console.error(`Error en generateStudyAid (${type}):`, error);
            setGeneratedAid(`Error al generar ${type}: ${error.message}.`);
        } finally {
            if (type !== 'mindmap_description') setIsLoadingStudyAid(false);
        }
    };

    // Explicar concepto clave con Gemini
    const explainKeyConcept = async () => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error") || !conceptToExplain.trim()) return;
        setIsLoadingExplanation(true);
        // ... (resetear estados)
        setActiveFeature('explanation');
        const prompt = `Eres un profesor experto... Explica "${conceptToExplain}"... Material:\n"""${extractedText}"""\n\nExplicación:`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const err = await response.json(); throw new Error(`API Error ${response.status}: ${err.error?.message || response.statusText}`); }
            const result = await response.json();
            setExplanationResult(result.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar la explicación.");
        } catch (error) {
            console.error("Error en explainKeyConcept:", error);
            setExplanationResult(`Error al explicar: ${error.message}.`);
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    // Generar ejemplos prácticos con Gemini
    const generatePracticalExamples = async () => {
        if (!extractedText || extractedText.toLowerCase().startsWith("error")) return;
        setIsLoadingExamples(true);
        // ... (resetear estados)
        setActiveFeature('examples');
        const prompt = `Eres un educador creativo... Genera 2-3 ejemplos prácticos... Material:\n"""${extractedText}"""\n\nEjemplos:`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const err = await response.json(); throw new Error(`API Error ${response.status}: ${err.error?.message || response.statusText}`); }
            const result = await response.json();
            setExamplesResult(result.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudieron generar ejemplos.");
        } catch (error) {
            console.error("Error en generatePracticalExamples:", error);
            setExamplesResult(`Error al generar ejemplos: ${error.message}.`);
        } finally {
            setIsLoadingExamples(false);
        }
    };

    // Exportar a PDF
    const handleExportToPDF = async () => {
        const input = exportContentRef.current;
        if (!input) return;
        if (typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') { console.log("Mostrando alerta simulada: Error librerías PDF"); return; }
        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`StudySpark_Resultados_${studyAidType || activeFeature || 'export'}.pdf`);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            console.log("Mostrando alerta simulada: Error al generar PDF");
        }
    };

    // Manejar respuesta del quiz
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

    // Manejar cambio en perfil de usuario
    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setUserProfile(prev => ({ ...prev, [name]: value }));
    };

    // Enviar cambios de perfil
    const submitProfile = () => {
        if (userId) {
            saveUserProfile(userId, userProfile);
        }
    };

    // Componentes de display (FAQ, Mapa Mental)
    const FaqDisplay = ({ data }) => {
        if (!Array.isArray(data)) return <p className={styles.resultContentError}>Error en datos de FAQ.</p>;
        if (data.length === 0) return <p>No se generaron preguntas y respuestas.</p>;
        return (
            <div className={styles.faqContainer}>
                {data.map((item, index) => (
                    <details key={index} className={styles.faqItem} open>
                        <summary className={styles.faqQuestion}>{index + 1}. {item.question}</summary>
                        <p className={styles.faqAnswer}>{item.answer}</p>
                    </details>
                ))}
            </div>
        );
    };
    const MindMapImageDisplay = ({ imageUrl }) => {
        if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.toLowerCase().startsWith("error")) {
            return <p className={styles.resultContentError}>{imageUrl || "No se pudo cargar imagen."}</p>;
        }
        return (
            <div className={styles.mindMapImageContainer}>
                <img src={imageUrl} alt="Mapa Mental Generado" className={styles.mindMapImage} />
                <p className={styles.mindMapImageCaption}>Calidad depende de IA.</p>
            </div>
        );
    };


    // Renderizado principal
    if (!isAuthReady) {
        return (
            <div className={styles.loadingAuthContainer}>
                <div className={styles.spinner}></div>
                <p className={styles.loadingAuthText}>Preparando StudySpark AI...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={styles.authPageContainer}>
                <div className={styles.authFormContainer}>
                    <div className={styles.authHeader}>
                        <AcademicCapIcon className={styles.titleIcon} />
                        <h1 className={styles.mainTitle}>StudySpark AI</h1>
                    </div>
                    <h2 className={styles.authFormTitle}>{isRegistering ? 'Crear Cuenta Nueva' : 'Iniciar Sesión'}</h2>
                    <form onSubmit={isRegistering ? handleSignUp : handleLogin} className={styles.authForm}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email">Email:</label>
                            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className={styles.authInput} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label htmlFor="password">Contraseña:</label>
                            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" required className={styles.authInput} />
                        </div>
                        {authError && <p className={styles.authErrorMessage}>{authError}</p>}
                        <button type="submit" disabled={isLoadingAuth} className={`${styles.buttonPrimary} ${styles.authButton}`}>
                            {isLoadingAuth ? <div className={styles.spinnerSmall}></div> : (isRegistering ? 'Registrarse' : 'Ingresar')}
                        </button>
                    </form>
                    <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); setEmail(''); setPassword(''); }} disabled={isLoadingAuth} className={styles.authToggleLink}>
                        {isRegistering ? '¿Ya tienes una cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>
                </div>
                <footer className={`${styles.appFooter} ${styles.authFooter}`}>
                    <p>&copy; {new Date().getFullYear()} StudySpark AI</p>
                    <p className={styles.appFooterSmallText}>by: Marcos Toselli</p>
                    <p className={styles.appFooterSmallText}>version - beta estado de prueba -</p>
                </footer>
            </div>
        );
    }

    return (
        <div className={styles.appContainer}>
            <header className={styles.appHeader}>
                <div className={styles.headerInfo}>
                    <div className={styles.userInfo}>
                        {user.email ? `Usuario: ${user.email}` : (userId ? `ID: ${userId.substring(0,10)}...` : 'Modo Anónimo')}
                    </div>
                    <div>
                        <button onClick={() => setShowProfileModal(true)} className={styles.profileButton} title="Perfil de Usuario">
                            <UserCircleIcon className={styles.profileIcon} />
                        </button>
                        <button onClick={handleLogout} disabled={isLoadingAuth} className={`${styles.profileButton} ${styles.logoutButton}`} title="Cerrar Sesión" style={{marginLeft: '0.5rem'}}>
                            {isLoadingAuth ? <div className={styles.spinnerSmall}></div> : <ArrowLeftOnRectangleIcon className={styles.profileIcon} />}
                        </button>
                    </div>
                </div>
                <h1 className={styles.mainTitle}>
                    <AcademicCapIcon className={styles.titleIcon} /> StudySpark AI
                </h1>
                <p className={styles.subTitle}>Transforma tus apuntes en herramientas de estudio interactivas con IA.</p>
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
                                <select id="studyLevel" name="studyLevel" value={userProfile.studyLevel} onChange={handleProfileChange} className={styles.modalSelect} >
                                    <option value="primaria">Primaria</option>
                                    <option value="secundaria">Secundaria</option>
                                    <option value="universidad">Universidad</option>
                                    <option value="profesional">Profesional</option>
                                    <option value="autodidacta">Autodidacta (General)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="language">Idioma Preferido (para IA):</label>
                                <select id="language" name="language" value={userProfile.language} onChange={handleProfileChange} className={styles.modalSelect} >
                                    <option value="es">Español</option>
                                    <option value="en">Inglés</option>
                                    <option value="pt">Portugués</option>
                                    <option value="fr">Francés</option>
                                </select>
                            </div>
                            <button onClick={submitProfile} className={`${styles.modalButton} ${styles.button}`} >
                                <CheckCircleIcon /> Guardar Perfil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className={styles.mainContent}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Sube tu Material de Estudio</h2>
                    <input type="file" accept="image/png, image/jpeg, image/webp, application/pdf" multiple onChange={handleImageUpload} ref={fileInputRef} style={{ display: 'none' }} />
                    <button onClick={triggerFileInput} className={styles.fileInputButton}>
                        <ArrowUpTrayIcon />
                        <span>Seleccionar Archivos (Imágenes o PDF)</span>
                    </button>
                    {imagePreviews.length > 0 && (
                        <div className={styles.imagePreviewContainer}>
                            <h3 className={styles.imagePreviewTitle}>Vista Previa ({imagePreviews.length} {imagePreviews.length === 1 ? "archivo" : "archivos"}):</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
                                {imagePreviews.map((preview, index) => (
                                    <div key={index} title={preview.name} style={{ textAlign: 'center', maxWidth: '150px', padding: '0.5rem', border: `1px solid #0ea5e9`, borderRadius: '0.375rem' }}>
                                        {preview.type === 'image' && preview.url ? (
                                            <img src={preview.url} alt={`Vista previa ${preview.name}`} style={{ maxHeight: '100px', width: 'auto', maxWidth: '100%', objectFit: 'contain', borderRadius: '0.25rem' }} />
                                        ) : preview.type === 'pdf' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', width: '100%'}}> <DocumentTextIcon style={{ height: '3rem', width: '3rem', color: '#38bdf8' }} /> </div>
                                        ) : ( <QuestionMarkCircleIcon style={{ height: '3rem', width: '3rem', color: '#94a3b8' }} /> )}
                                        <p style={{ fontSize: '0.7rem', color: '#7dd3fc', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{preview.name}</p>
                                    </div>
                                ))}
                            </div>
                            <button onClick={extractTextFromImage} disabled={isLoadingText || images.length === 0} className={`${styles.buttonGreen} ${styles.button}`} style={{ marginTop: '1rem', marginLeft: 'auto', marginRight: 'auto' }} >
                                {isLoadingText ? ( <> <div className={styles.spinner} style={{ height: '1.25rem', width: '1.25rem', borderWidth: '2px', marginRight: '0.5rem' }}></div> Extrayendo Texto... </> ) : ( <> <DocumentTextIcon /> Procesar {images.length > 1 ? `${images.length} Archivos` : 'Archivo'} </> )}
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
                                        {isLoadingExplanation ? <div className={styles.spinner} style={{height: '1rem', width: '1rem', borderWidth: '2px'}}></div> : <SparklesIcon />} <span style={{marginLeft: '0.5rem'}}>Explicar</span>
                                    </button>
                                </div>
                            </div>
                            <button onClick={generatePracticalExamples} disabled={isLoadingExamples} className={`${styles.buttonLime} ${styles.button}`}>
                                {isLoadingExamples ? <div className={styles.spinner} style={{height: '1.25rem', width: '1.25rem', borderWidth: '2px', marginRight: '0.5rem'}}></div> : <BeakerIcon />} Generar Ejemplos Prácticos
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

                {/* SECCIÓN DE RESULTADOS CON CLASE PARA PDF */}
                {((!isLoadingStudyAid && !isLoadingMindMapImage && generatedAid) ||
                  (!isLoadingExplanation && explanationResult) ||
                  (!isLoadingExamples && examplesResult)) && (
                    <section className={styles.section}>
                        <div ref={exportContentRef} className={styles.pdfExportArea}>
                            {activeFeature === 'explanation' && explanationResult && (
                                <>
                                    <h2 className={styles.sectionSubTitle}>✨ Explicación del Concepto: <span style={{color: '#22d3ee'}}>{conceptToExplain}</span></h2>
                                    <div className={styles.resultContent}>
                                        {explanationResult}
                                    </div>
                                </>
                            )}
                            {isLoadingExplanation && activeFeature === 'explanation' && (
                                <div className={styles.loadingIndicatorContainer} style={{padding: '1.5rem', backgroundColor: 'transparent', boxShadow: 'none'}}>
                                    <div className={styles.spinner} style={{borderColor: '#06b6d4', height: '2rem', width: '2rem'}}></div>
                                    <p className={styles.loadingText} style={{fontSize: '1.125rem', color: '#67e8f9'}}>Explicando concepto...</p>
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
                            {/* CORRECCIÓN AQUÍ: Reemplazar el comentario con el JSX del indicador de carga */}
                            {isLoadingExamples && activeFeature === 'examples' && (
                                <div className={styles.loadingIndicatorContainer} style={{padding: '1.5rem', backgroundColor: 'transparent', boxShadow: 'none'}}>
                                    <div className={styles.spinner} style={{borderColor: '#84cc16', height: '2rem', width: '2rem'}}></div>
                                    <p className={styles.loadingText} style={{fontSize: '1.125rem', color: '#a3e635'}}>Generando ejemplos...</p>
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
                                <button onClick={() => setShowShareModal(false)} className={styles.modalCloseButton}> <XMarkIcon style={{height: '1.5rem', width: '1.5rem'}} /> </button>
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
