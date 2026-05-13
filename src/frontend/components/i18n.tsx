import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type LanguageCode = "en" | "ha" | "yo" | "ig";

export const LANGUAGES: Array<{ code: LanguageCode; shortLabel: string; label: string }> = [
  { code: "en", shortLabel: "EN", label: "English" },
  { code: "ha", shortLabel: "HA", label: "Hausa" },
  { code: "yo", shortLabel: "YO", label: "Yoruba" },
  { code: "ig", shortLabel: "IG", label: "Igbo" },
];

const STORAGE_KEY = "maize-detection-language";

const localeByLanguage: Record<LanguageCode, string> = {
  en: "en-NG",
  ha: "ha-NG",
  yo: "yo-NG",
  ig: "ig-NG",
};

const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en: {
    "document.title": "Maize Detection Demo",
    "app.brand": "Maize Detection",
    "app.academicDemo": "Academic project demo",
    "app.detectorWorkspace": "Detection workspace",
    "language.label": "Language",
    "language.en": "English",
    "language.ha": "Hausa",
    "language.yo": "Yoruba",
    "language.ig": "Igbo",
    "auth.addSupabase": "Add Supabase keys to enable auth",
    "auth.checkingSession": "Checking session...",
    "auth.signedInAs": "Signed in as {name}",
    "auth.login": "Log in",
    "auth.signup": "Sign up",
    "auth.logout": "Logout",
    "auth.userFallback": "User",
    "authModal.close": "Close auth form",
    "authModal.createTitle": "Create your account",
    "authModal.loginTitle": "Login",
    "authModal.name": "Name",
    "authModal.email": "Email",
    "authModal.password": "Password",
    "authModal.wait": "Please wait...",
    "authModal.createAccount": "Create account",
    "authModal.accountCreated": "Account created. Check your email to confirm your address, then log in.",
    "authModal.supabaseMissing": "Supabase is not configured yet.",
    "authModal.authFailed": "Authentication failed.",
    "authModal.haveAccount": "Already have an account?",
    "authModal.needAccount": "Need an account?",
    "landing.kicker": "Maize leaf diagnosis study",
    "landing.title": "Early Disease Detection System for Maize Leaves",
    "landing.copy": "Upload a maize leaf image, run the trained classifier, and review the model's confidence across common maize health classes.",
    "landing.start": "Start detection",
    "landing.footnote": "Built for demonstration and study.",
    "landing.overviewKicker": "What the demo shows",
    "landing.overviewTitle": "One focused workflow from image to prediction.",
    "landing.stepUploadTitle": "Upload a leaf",
    "landing.stepUploadText": "Start with a clear maize leaf photo from the demo device or your computer.",
    "landing.stepConfidenceTitle": "Review confidence",
    "landing.stepConfidenceText": "The app returns the top class plus confidence scores across the trained labels.",
    "landing.stepGuidanceTitle": "Read guidance",
    "landing.stepGuidanceText": "Accepted predictions include short treatment and prevention notes for review.",
    "detector.accountControls": "Detection account controls",
    "detector.heroKicker": "AI Crop Health Scanner",
    "detector.heroTitle": "Maize Leaf Disease Detection",
    "detector.heroCopy": "Upload a clear maize leaf image to detect common diseases including Gray Leaf Spot, Common Rust, and Northern Leaf Blight.",
    "detector.uploadTitle": "1) Upload Leaf Image",
    "detector.chooseFile": "Choose File",
    "detector.noFile": "No file selected",
    "detector.previewAlt": "Selected maize leaf",
    "detector.previewEmpty": "A preview will appear here once an image is selected.",
    "detector.analyze": "Analyze Image",
    "detector.analyzing": "Analyzing",
    "detector.reset": "Reset",
    "detector.runningInference": "Running model inference on the uploaded leaf...",
    "detector.historyPreview": "This image was restored from detection history. Choose a new file to analyze another image.",
    "detector.predictionFailed": "Prediction failed",
    "detector.guidanceTitle": "3) Treatment and Prevention",
    "detector.guidanceEmpty": "Treatment and prevention guidance will appear here after the image is analyzed.",
    "detector.treatment": "Treatment",
    "detector.prevention": "Prevention",
    "detector.resultTitle": "2) Analysis Result",
    "detector.resultEmpty": "Results will appear here after analysis, including confidence scores for all classes.",
    "detector.primaryDetection": "Primary Detection",
    "detector.detectedClass": "Detected class from the trained maize model.",
    "detector.confidence": "Confidence",
    "detector.allPredictions": "All predictions",
    "detector.historyTitle": "4) Detection History",
    "detector.historyHint": "(Click item to view history)",
    "detector.items": "items",
    "detector.loadingHistory": "Loading previous detections...",
    "detector.historyUnavailable": "History unavailable",
    "detector.historyEmpty": "Successful detections will be saved here so you can reopen them later.",
    "detector.delete": "Delete",
    "detector.errorInvalidImage": "Please upload a valid image file.",
    "detector.errorSelectImage": "Please select an image first.",
    "detector.errorPredictionGeneric": "Prediction failed",
    "detector.errorGeneric": "An error occurred",
    "detector.errorHistoryLoad": "Detection history is unavailable in this browser.",
    "detector.errorHistorySave": "Could not save this detection to local history.",
    "detector.errorHistoryDelete": "Could not delete this history item.",
  },
  ha: {
    "document.title": "Gwajin Gano Cutar Masara",
    "app.brand": "Gano Cutar Masara",
    "app.academicDemo": "Aikin makaranta na gwaji",
    "app.detectorWorkspace": "Wurin gano cuta",
    "language.label": "Harshe",
    "language.en": "Turanci",
    "language.ha": "Hausa",
    "language.yo": "Yoruba",
    "language.ig": "Igbo",
    "auth.addSupabase": "Saka maɓallan Supabase domin kunna shiga",
    "auth.checkingSession": "Ana duba zaman shiga...",
    "auth.signedInAs": "An shiga da {name}",
    "auth.login": "Shiga",
    "auth.signup": "Yi rajista",
    "auth.logout": "Fita",
    "auth.userFallback": "Mai amfani",
    "authModal.close": "Rufe fom ɗin shiga",
    "authModal.createTitle": "Ƙirƙiri asusunka",
    "authModal.loginTitle": "Shiga",
    "authModal.name": "Suna",
    "authModal.email": "Imel",
    "authModal.password": "Kalmar sirri",
    "authModal.wait": "A ɗan jira...",
    "authModal.createAccount": "Ƙirƙiri asusu",
    "authModal.accountCreated": "An ƙirƙiri asusu. Duba imel ɗinka don tabbatarwa, sai ka shiga.",
    "authModal.supabaseMissing": "Ba a saita Supabase ba tukuna.",
    "authModal.authFailed": "Shiga bai yiwu ba.",
    "authModal.haveAccount": "Kana da asusu?",
    "authModal.needAccount": "Kana buƙatar asusu?",
    "landing.kicker": "Nazarin ganyen masara",
    "landing.title": "Tsarin gano cututtukan ganyen masara da wuri",
    "landing.copy": "Loda hoton ganyen masara, gudanar da samfurin koyon na'ura, sannan duba amincewar sakamakon a kan nau'o'in lafiyar masara.",
    "landing.start": "Fara gano cuta",
    "landing.footnote": "An gina shi don gwaji da nazari.",
    "landing.overviewKicker": "Abin da gwajin yake nuna wa",
    "landing.overviewTitle": "Hanya ɗaya mai sauƙi daga hoto zuwa hasashe.",
    "landing.stepUploadTitle": "Loda ganye",
    "landing.stepUploadText": "Fara da hoton ganyen masara mai kyau daga na'ura ko kwamfutarka.",
    "landing.stepConfidenceTitle": "Duba amincewa",
    "landing.stepConfidenceText": "Manhajar tana dawo da ajin da ya fi dacewa da makin amincewa na sauran alamomi.",
    "landing.stepGuidanceTitle": "Karanta shawarwari",
    "landing.stepGuidanceText": "Sakamakon da aka karɓa yana da takaitaccen magani da kariya don dubawa.",
    "detector.accountControls": "Saitunan asusun gano cuta",
    "detector.heroKicker": "Na'urar duba lafiyar amfanin gona da AI",
    "detector.heroTitle": "Gano cutar ganyen masara",
    "detector.heroCopy": "Loda hoton ganyen masara mai kyau don gano cututtuka kamar tabon ganye mai toka, tsatsa ta gama gari, da bushewar ganye ta arewa.",
    "detector.uploadTitle": "1) Loda hoton ganye",
    "detector.chooseFile": "Zaɓi fayil",
    "detector.noFile": "Ba a zaɓi fayil ba",
    "detector.previewAlt": "Hoton ganyen masara da aka zaɓa",
    "detector.previewEmpty": "Za a nuna samfuri a nan bayan an zaɓi hoto.",
    "detector.analyze": "Bincika hoto",
    "detector.analyzing": "Ana bincika",
    "detector.reset": "Sake saitawa",
    "detector.runningInference": "Ana gudanar da hasashen samfurin a kan ganyen da aka loda...",
    "detector.historyPreview": "An dawo da wannan hoto daga tarihin gano cuta. Zaɓi sabon fayil don bincika wani hoto.",
    "detector.predictionFailed": "Hasashe bai yiwu ba",
    "detector.guidanceTitle": "3) Magani da kariya",
    "detector.guidanceEmpty": "Shawarwarin magani da kariya za su bayyana a nan bayan an bincika hoton.",
    "detector.treatment": "Magani",
    "detector.prevention": "Kariya",
    "detector.resultTitle": "2) Sakamakon bincike",
    "detector.resultEmpty": "Sakamako zai bayyana a nan bayan bincike, tare da makin amincewa ga dukkan aji.",
    "detector.primaryDetection": "Babban gano cuta",
    "detector.detectedClass": "Ajin da aka gano daga samfurin masara da aka horar.",
    "detector.confidence": "Amincewa",
    "detector.allPredictions": "Dukkan hasashe",
    "detector.historyTitle": "4) Tarihin gano cuta",
    "detector.historyHint": "(Danna abu don duba tarihi)",
    "detector.items": "abubuwa",
    "detector.loadingHistory": "Ana ɗora gano cututtukan da suka gabata...",
    "detector.historyUnavailable": "Tarihi ba ya samuwa",
    "detector.historyEmpty": "Za a adana gano cututtukan da suka yi nasara a nan domin a buɗe su daga baya.",
    "detector.delete": "Goge",
    "detector.errorInvalidImage": "Da fatan za a loda fayil ɗin hoto mai inganci.",
    "detector.errorSelectImage": "Da fatan za a zaɓi hoto tukuna.",
    "detector.errorPredictionGeneric": "Hasashe bai yiwu ba",
    "detector.errorGeneric": "An samu matsala",
    "detector.errorHistoryLoad": "Tarihin gano cuta ba ya samuwa a wannan burauzar.",
    "detector.errorHistorySave": "Ba a iya adana wannan gano cuta a tarihin gida ba.",
    "detector.errorHistoryDelete": "Ba a iya goge wannan abu na tarihi ba.",
  },
  yo: {
    "document.title": "Àfihàn Ìwádìí Arun Agbado",
    "app.brand": "Ìwádìí Arun Agbado",
    "app.academicDemo": "Àpẹẹrẹ iṣẹ́ ẹ̀kọ́",
    "app.detectorWorkspace": "Ibùdó ìwádìí",
    "language.label": "Èdè",
    "language.en": "Gẹ̀ẹ́sì",
    "language.ha": "Hausa",
    "language.yo": "Yorùbá",
    "language.ig": "Igbo",
    "auth.addSupabase": "Fi bọtini Supabase kun láti ṣiṣẹ́ ìforúkọsílẹ̀",
    "auth.checkingSession": "Ń ṣàyẹ̀wò ìwọlé...",
    "auth.signedInAs": "O wọlé gẹ́gẹ́ bí {name}",
    "auth.login": "Wọlé",
    "auth.signup": "Forúkọsílẹ̀",
    "auth.logout": "Jade",
    "auth.userFallback": "Olùmúlò",
    "authModal.close": "Pa fọ́ọ̀mù ìwọlé",
    "authModal.createTitle": "Ṣẹ̀dá àkọọlẹ rẹ",
    "authModal.loginTitle": "Wọlé",
    "authModal.name": "Orúkọ",
    "authModal.email": "Ímeèlì",
    "authModal.password": "Ọ̀rọ̀ aṣínà",
    "authModal.wait": "Jọ̀wọ́ dúró...",
    "authModal.createAccount": "Ṣẹ̀dá àkọọlẹ",
    "authModal.accountCreated": "A ti ṣẹ̀dá àkọọlẹ. Ṣàyẹ̀wò ímeèlì rẹ láti jẹ́rìí, lẹ́yìn náà wọlé.",
    "authModal.supabaseMissing": "A kò tíì ṣètò Supabase.",
    "authModal.authFailed": "Ìwọlé kò ṣàṣeyọrí.",
    "authModal.haveAccount": "Ṣé o ti ní àkọọlẹ?",
    "authModal.needAccount": "Ṣé o nílò àkọọlẹ?",
    "landing.kicker": "Ìwádìí ewé agbado",
    "landing.title": "Ètò ìwádìí arun ewé agbado ní kutukutu",
    "landing.copy": "Gbé àwòrán ewé agbado wọlé, jẹ́ kí awoṣe tí a kọ́ ṣiṣẹ́, kí o sì wo ìgbẹ́kẹ̀lé rẹ lórí àwọn kilasi ìlera agbado.",
    "landing.start": "Bẹ̀rẹ̀ ìwádìí",
    "landing.footnote": "A kọ́ ọ fún àfihàn àti ìkẹ́kọ̀ọ́.",
    "landing.overviewKicker": "Ohun tí àfihàn yìí ń fi hàn",
    "landing.overviewTitle": "Ìlànà kan ṣoṣo láti àwòrán dé sí abajade.",
    "landing.stepUploadTitle": "Gbé ewé wọlé",
    "landing.stepUploadText": "Bẹ̀rẹ̀ pẹ̀lú àwòrán ewé agbado tó mọ́ láti ẹrọ àfihàn tàbí kọ̀ǹpútà rẹ.",
    "landing.stepConfidenceTitle": "Wo ìgbẹ́kẹ̀lé",
    "landing.stepConfidenceText": "Ohun èlò náà ń dá kilasi tó ga jù àti ìwọn ìgbẹ́kẹ̀lé fún gbogbo àmì tí a kọ́ padà.",
    "landing.stepGuidanceTitle": "Ka ìtọ́nisọ́nà",
    "landing.stepGuidanceText": "Àwọn abajade tí a gba ni ìtọ́nisọ́nà ìtọju àti ìdènà kúkúrú fún àyẹ̀wò.",
    "detector.accountControls": "Àwọn ìṣàkóso àkọọlẹ ìwádìí",
    "detector.heroKicker": "Ẹrọ AI fún ìlera irugbin",
    "detector.heroTitle": "Ìwádìí arun ewé agbado",
    "detector.heroCopy": "Gbé àwòrán ewé agbado tó mọ́ wọlé láti ṣàwárí arun bíi àbà ewé grẹy, ipata wọ́pọ̀, àti gbigbẹ ewé ariwa.",
    "detector.uploadTitle": "1) Gbé àwòrán ewé wọlé",
    "detector.chooseFile": "Yan fáìlì",
    "detector.noFile": "Kò sí fáìlì tí a yan",
    "detector.previewAlt": "Àwòrán ewé agbado tí a yan",
    "detector.previewEmpty": "Àpẹẹrẹ yóò hàn níbí lẹ́yìn tí a bá yan àwòrán.",
    "detector.analyze": "Ṣàyẹ̀wò àwòrán",
    "detector.analyzing": "Ń ṣàyẹ̀wò",
    "detector.reset": "Tún bẹ̀rẹ̀",
    "detector.runningInference": "Awoṣe ń ṣiṣẹ́ lórí ewé tí a gbe wọlé...",
    "detector.historyPreview": "A mu àwòrán yìí padà láti ìtàn ìwádìí. Yan fáìlì tuntun láti ṣàyẹ̀wò àwòrán míì.",
    "detector.predictionFailed": "Asọtẹ́lẹ̀ kùnà",
    "detector.guidanceTitle": "3) Ìtọju àti ìdènà",
    "detector.guidanceEmpty": "Ìtọ́nisọ́nà ìtọju àti ìdènà yóò hàn níbí lẹ́yìn ìtúpalẹ̀ àwòrán.",
    "detector.treatment": "Ìtọju",
    "detector.prevention": "Ìdènà",
    "detector.resultTitle": "2) Abajade ìtúpalẹ̀",
    "detector.resultEmpty": "Abajade yóò hàn níbí lẹ́yìn ìtúpalẹ̀, pẹ̀lú ìwọn ìgbẹ́kẹ̀lé fún gbogbo kilasi.",
    "detector.primaryDetection": "Ìwádìí àkọ́kọ́",
    "detector.detectedClass": "Kilasi tí awoṣe agbado tí a kọ́ rí.",
    "detector.confidence": "Ìgbẹ́kẹ̀lé",
    "detector.allPredictions": "Gbogbo asọtẹ́lẹ̀",
    "detector.historyTitle": "4) Ìtàn ìwádìí",
    "detector.historyHint": "(Tẹ ohun kan láti wo ìtàn)",
    "detector.items": "ohun",
    "detector.loadingHistory": "Ń kojú ìwádìí iṣaaju...",
    "detector.historyUnavailable": "Ìtàn kò sí",
    "detector.historyEmpty": "Àwọn ìwádìí tó ṣàṣeyọrí yóò wa níbí kí o lè tún ṣí wọn lẹ́yìn náà.",
    "detector.delete": "Paarẹ",
    "detector.errorInvalidImage": "Jọ̀wọ́ gbé fáìlì àwòrán tó tọ́ wọlé.",
    "detector.errorSelectImage": "Jọ̀wọ́ kọ́kọ́ yan àwòrán.",
    "detector.errorPredictionGeneric": "Asọtẹ́lẹ̀ kùnà",
    "detector.errorGeneric": "Àṣìṣe ṣẹlẹ̀",
    "detector.errorHistoryLoad": "Ìtàn ìwádìí kò sí nínú aṣàwákiri yìí.",
    "detector.errorHistorySave": "Kò le fi ìwádìí yìí pamọ́ sínú ìtàn abẹ́lé.",
    "detector.errorHistoryDelete": "Kò le pa ohun ìtàn yìí rẹ́.",
  },
  ig: {
    "document.title": "Ngosipụta Nchọpụta Ọrịa Ọka",
    "app.brand": "Nchọpụta Ọrịa Ọka",
    "app.academicDemo": "Ngosipụta ọrụ ọmụmụ",
    "app.detectorWorkspace": "Ebe nchọpụta",
    "language.label": "Asụsụ",
    "language.en": "Bekee",
    "language.ha": "Hausa",
    "language.yo": "Yoruba",
    "language.ig": "Igbo",
    "auth.addSupabase": "Tinye igodo Supabase iji mee ka nbanye rụọ ọrụ",
    "auth.checkingSession": "A na-enyocha nnọkọ...",
    "auth.signedInAs": "Abanyela dị ka {name}",
    "auth.login": "Banye",
    "auth.signup": "Debanye aha",
    "auth.logout": "Pụọ",
    "auth.userFallback": "Onye ọrụ",
    "authModal.close": "Mechie fọm nbanye",
    "authModal.createTitle": "Mepụta akaụntụ gị",
    "authModal.loginTitle": "Banye",
    "authModal.name": "Aha",
    "authModal.email": "Email",
    "authModal.password": "Okwuntughe",
    "authModal.wait": "Biko chere...",
    "authModal.createAccount": "Mepụta akaụntụ",
    "authModal.accountCreated": "Emeela akaụntụ. Lelee email gị iji kwado ya, mgbe ahụ banye.",
    "authModal.supabaseMissing": "A hazibeghị Supabase.",
    "authModal.authFailed": "Nbanye agaghị.",
    "authModal.haveAccount": "Ị nwere akaụntụ?",
    "authModal.needAccount": "Ị chọrọ akaụntụ?",
    "landing.kicker": "Ọmụmụ akwụkwọ ọka",
    "landing.title": "Usoro ịchọpụta ọrịa akwụkwọ ọka n'oge",
    "landing.copy": "Bulite foto akwụkwọ ọka, mee ka klaasifaịa a zụrụ rụọ ọrụ, ma nyochaa ntụkwasị obi ya n'òtù ahụike ọka.",
    "landing.start": "Malite nchọpụta",
    "landing.footnote": "E wuru ya maka ngosi na ọmụmụ.",
    "landing.overviewKicker": "Ihe ngosi a na-egosi",
    "landing.overviewTitle": "Usoro otu ụzọ site na foto ruo na amụma.",
    "landing.stepUploadTitle": "Bulite akwụkwọ",
    "landing.stepUploadText": "Malite na foto akwụkwọ ọka doro anya sitere na ngwaọrụ ngosi ma ọ bụ kọmputa gị.",
    "landing.stepConfidenceTitle": "Nyochaa ntụkwasị obi",
    "landing.stepConfidenceText": "Ngwa ahụ na-eweghachi klas kachasị elu na akara ntụkwasị obi n'aha niile a zụrụ.",
    "landing.stepGuidanceTitle": "Gụọ ntụziaka",
    "landing.stepGuidanceText": "Nsonaazụ a nabatara nwere ndụmọdụ ọgwụgwọ na mgbochi dị mkpirikpi.",
    "detector.accountControls": "Njikwa akaụntụ nchọpụta",
    "detector.heroKicker": "Nyocha ahụike ihe ọkụkụ AI",
    "detector.heroTitle": "Nchọpụta ọrịa akwụkwọ ọka",
    "detector.heroCopy": "Bulite foto akwụkwọ ọka doro anya iji chọpụta ọrịa dịka ntụpọ akwụkwọ isi awọ, nchara nkịtị, na ọkụ akwụkwọ ugwu.",
    "detector.uploadTitle": "1) Bulite foto akwụkwọ",
    "detector.chooseFile": "Họrọ faịlụ",
    "detector.noFile": "Enweghị faịlụ ahọpụtara",
    "detector.previewAlt": "Akwụkwọ ọka ahọpụtara",
    "detector.previewEmpty": "Nlele ga-apụta ebe a ozugbo ahọpụtara foto.",
    "detector.analyze": "Nyochaa foto",
    "detector.analyzing": "A na-enyocha",
    "detector.reset": "Malitegharịa",
    "detector.runningInference": "A na-agba amụma model n'akwụkwọ e bulitere...",
    "detector.historyPreview": "E weghachitere foto a site n'akụkọ nchọpụta. Họrọ faịlụ ọhụrụ iji nyochaa foto ọzọ.",
    "detector.predictionFailed": "Amụma dara",
    "detector.guidanceTitle": "3) Ọgwụgwọ na mgbochi",
    "detector.guidanceEmpty": "Ndụmọdụ ọgwụgwọ na mgbochi ga-apụta ebe a mgbe enyochachara foto.",
    "detector.treatment": "Ọgwụgwọ",
    "detector.prevention": "Mgbochi",
    "detector.resultTitle": "2) Nsonaazụ nyocha",
    "detector.resultEmpty": "Nsonaazụ ga-apụta ebe a mgbe nyocha gasịrị, tinyere akara ntụkwasị obi maka klas niile.",
    "detector.primaryDetection": "Nchọpụta bụ isi",
    "detector.detectedClass": "Klas achọpụtara site na model ọka a zụrụ.",
    "detector.confidence": "Ntụkwasị obi",
    "detector.allPredictions": "Amụma niile",
    "detector.historyTitle": "4) Akụkọ nchọpụta",
    "detector.historyHint": "(Pịa ihe iji hụ akụkọ)",
    "detector.items": "ihe",
    "detector.loadingHistory": "A na-ebunye nchọpụta gara aga...",
    "detector.historyUnavailable": "Akụkọ adịghị",
    "detector.historyEmpty": "A ga-echekwa nchọpụta gara nke ọma ebe a ka ị nwee ike imeghe ha ọzọ.",
    "detector.delete": "Hichapụ",
    "detector.errorInvalidImage": "Biko bulite faịlụ foto ziri ezi.",
    "detector.errorSelectImage": "Biko họrọ foto mbụ.",
    "detector.errorPredictionGeneric": "Amụma dara",
    "detector.errorGeneric": "Mmejọ mere",
    "detector.errorHistoryLoad": "Akụkọ nchọpụta adịghị na nchọgharị a.",
    "detector.errorHistorySave": "Enweghị ike ichekwa nchọpụta a na akụkọ mpaghara.",
    "detector.errorHistoryDelete": "Enweghị ike ihichapụ ihe akụkọ a.",
  },
};

type DiseaseKey =
  | "healthy"
  | "northernLeafBlight"
  | "commonRust"
  | "grayLeafSpot"
  | "unknown"
  | "recommendationUnavailable";

export interface LocalizedGuidance {
  title: string;
  description: string;
  treatment: string;
  prevention: string;
}

const diseaseContent: Record<LanguageCode, Record<DiseaseKey, LocalizedGuidance>> = {
  en: {
    healthy: {
      title: "Healthy Leaf",
      description: "No visible signs of major maize leaf disease.",
      treatment: "No treatment is needed right now. Keep scouting the field and respond quickly if new lesions or pustules begin to appear.",
      prevention: "Maintain regular field scouting, choose hybrids with good disease resistance for your area, and keep overall crop stress low with sound agronomic management.",
    },
    northernLeafBlight: {
      title: "Northern Leaf Blight",
      description: "Fungal disease with elongated gray-green lesions that reduce yield.",
      treatment: "Apply a labeled foliar fungicide when disease is active and moving up the canopy, especially near tasseling to silking.",
      prevention: "Use hybrids with strong Northern Leaf Blight resistance, rotate away from corn, and manage corn residue where practical.",
    },
    commonRust: {
      title: "Common Rust",
      description: "Reddish-brown pustules caused by rust fungi on both leaf surfaces.",
      treatment: "If rust is increasing early on susceptible corn, apply a labeled foliar fungicide while pustules are still limited.",
      prevention: "Prioritize resistant hybrids first, since common rust spores often blow in from outside the field.",
    },
    grayLeafSpot: {
      title: "Gray Leaf Spot",
      description: "Rectangular gray lesions that often expand along leaf veins.",
      treatment: "Apply a labeled foliar fungicide promptly when Gray Leaf Spot is active, especially when lesions approach the upper canopy.",
      prevention: "Use resistant hybrids, avoid continuous corn where possible, and manage infested corn residue.",
    },
    unknown: {
      title: "Image Rejected",
      description: "This image does not look like a confident match for the trained maize disease classes.",
      treatment: "Retake the photo so a single maize leaf fills most of the frame. Avoid blur, heavy shadows, and unrelated background objects.",
      prevention: "Use a clear field photo of a maize leaf from the front, and add non-maize images to training if you want the model to reject them reliably.",
    },
    recommendationUnavailable: {
      title: "Recommendation unavailable",
      description: "A prediction was returned, but disease guidance was not included in the response.",
      treatment: "Review the result with an agronomist or extension source before taking action.",
      prevention: "Keep scouting the crop and use local disease management guidance for follow-up decisions.",
    },
  },
  ha: {
    healthy: {
      title: "Ganye mai lafiya",
      description: "Ba a ga alamun manyan cututtukan ganyen masara ba.",
      treatment: "Babu magani da ake bukata yanzu. Ci gaba da duba gona, kuma ka ɗauki mataki da wuri idan sabbin tabo ko ƙuraje sun bayyana.",
      prevention: "Ci gaba da binciken gona akai-akai, zaɓi irin masara mai jure cuta, kuma rage damuwar amfanin gona ta hanyar kula da gona yadda ya kamata.",
    },
    northernLeafBlight: {
      title: "Bushewar ganye ta arewa",
      description: "Cutar fungi ce mai dogayen tabo kore-toka da ke rage amfanin gona.",
      treatment: "Yi amfani da maganin fungi na ganye da aka amince da shi idan cutar tana yaduwa sama a jikin shuka.",
      prevention: "Yi amfani da irin da ke jure wannan cuta, juya amfanin gona idan zai yiwu, kuma sarrafa ragowar masara a gona.",
    },
    commonRust: {
      title: "Tsatsa ta gama gari",
      description: "Ƙurajen ja-ruwan kasa da fungi ke haifarwa a bangarorin ganye biyu.",
      treatment: "Idan tsatsa tana ƙaruwa da wuri a masara mai rauni, yi amfani da maganin fungi na ganye kafin ta bazu sosai.",
      prevention: "Fara da zaɓar irin masara mai jure cuta, domin ƙwayoyin tsatsa kan zo daga wajen gona.",
    },
    grayLeafSpot: {
      title: "Tabon ganye mai toka",
      description: "Tabo masu siffar murabba'i masu launin toka da kan bi jijiyoyin ganye.",
      treatment: "Yi amfani da maganin fungi na ganye da wuri idan tabon ganye mai toka yana aiki, musamman idan ya kusanci saman shuka.",
      prevention: "Yi amfani da irin da ke jure cuta, kauce wa noma masara a wuri ɗaya kullum idan zai yiwu, kuma sarrafa ragowar masara.",
    },
    unknown: {
      title: "An ƙi hoton",
      description: "Hoton bai yi kama da abin da samfurin ya koya na cututtukan masara da tabbaci ba.",
      treatment: "Sake ɗaukar hoto inda ganye ɗaya na masara ya cika yawancin firam. Ka guji blur, inuwa mai yawa, da abubuwan baya marasa alaƙa.",
      prevention: "Yi amfani da hoton ganyen masara mai kyau daga gaba, kuma ƙara hotunan da ba na masara ba a horo idan kana son samfurin ya ƙi su.",
    },
    recommendationUnavailable: {
      title: "Babu shawara",
      description: "An dawo da hasashe, amma ba a haɗa shawarwarin cuta ba.",
      treatment: "Tuntuɓi masanin noma ko tushen faɗaɗa kafin ɗaukar mataki.",
      prevention: "Ci gaba da duba amfanin gona kuma yi amfani da shawarwarin kula da cuta na yankinku.",
    },
  },
  yo: {
    healthy: {
      title: "Ewé tó ní ìlera",
      description: "Kò sí àmì kedere ti arun ewé agbado ńlá.",
      treatment: "Kò sí ìtọju tó yẹ nísinsìnyí. Máa ṣàyẹ̀wò oko, kí o sì dáhùn kíákíá bí àbà tàbí ìpata tuntun bá hàn.",
      prevention: "Máa ṣe àyẹ̀wò oko déédéé, yan irú agbado tó ní agbára lòdì sí arun, kí o sì dín ìnira irugbin kù.",
    },
    northernLeafBlight: {
      title: "Gbigbẹ ewé ariwa",
      description: "Arun fungi pẹ̀lú àbà gígùn aláwọ̀ ewé-toka tó lè dín èso kù.",
      treatment: "Lo oogun fungi ewé tí a fọwọ́ sí nígbà tí arun bá ń ṣiṣẹ́, pàápàá nígbà tó ń lọ sí apá òkè irugbin.",
      prevention: "Lo irú tó ní agbára lòdì sí arun yìí, yí irugbin padà, kí o sì ṣàkóso ìyókù agbado ní oko.",
    },
    commonRust: {
      title: "Ipata wọ́pọ̀",
      description: "Àwọn ìpata pupa-bùrúùní tí fungi ń fa lórí méjèèjì ewé.",
      treatment: "Bí ipata bá ń pọ̀ síi ní kutukutu, lo oogun fungi ewé nígbà tí ìpata kò tíì tan kaakiri.",
      prevention: "Yan irú agbado tó le koju arun kọ́kọ́, nítorí eruku ipata sábà máa ń wọlé láti òde oko.",
    },
    grayLeafSpot: {
      title: "Àbà ewé grẹy",
      description: "Àbà grẹy onígùn mẹ́rin tí ó sábà ń tẹ̀ lé iṣan ewé.",
      treatment: "Lo oogun fungi ewé kíákíá nígbà tí àbà ewé grẹy bá ń ṣiṣẹ́, pàápàá tí ó bá ń sún mọ́ apá òkè irugbin.",
      prevention: "Lo irú tó ní agbára lòdì sí arun, yago fún agbado lẹ́ẹ̀kan sí lẹ́ẹ̀kan ní ibi kan, kí o sì ṣàkóso ìyókù agbado.",
    },
    unknown: {
      title: "A kọ àwòrán",
      description: "Àwòrán yìí kò jọ ohun tí awoṣe kọ́ fún arun agbado pẹ̀lú ìgbẹ́kẹ̀lé.",
      treatment: "Tún ya àwòrán kí ewé agbado kan ṣoṣo kun púpọ̀ nínú fireemu. Yago fún àwòrán tí kò dáa, ojiji púpọ̀, àti ohun abẹ́lẹ̀ tí kò ní ìbáṣepọ̀.",
      prevention: "Lo àwòrán oko tó mọ́ ti ewé agbado láti iwájú, kí o sì fi àwòrán tí kì í ṣe agbado kun ìkọ́ni bí o bá fẹ́ kí awoṣe kọ́ wọn.",
    },
    recommendationUnavailable: {
      title: "Ìmọ̀ràn kò sí",
      description: "Asọtẹ́lẹ̀ padà, ṣùgbọ́n kò sí ìtọ́nisọ́nà arun nínú èsì.",
      treatment: "Ṣàyẹ̀wò abajade náà pẹ̀lú amọ̀ja oko tàbí orísun ìtọ́nisọ́nà kí o tó ṣe ìgbésẹ̀.",
      prevention: "Máa ṣàyẹ̀wò irugbin, kí o sì lo ìtọ́nisọ́nà ìṣàkóso arun agbègbè rẹ.",
    },
  },
  ig: {
    healthy: {
      title: "Akwụkwọ dị mma",
      description: "Enweghị ihe ịrịba ama doro anya nke nnukwu ọrịa akwụkwọ ọka.",
      treatment: "Ọ dịghị ọgwụgwọ achọrọ ugbu a. Na-enyocha ubi mgbe niile ma mee ngwa ngwa ma ọ bụrụ na ntụpọ ọhụrụ ma ọ bụ nchara apụta.",
      prevention: "Na-enyocha ubi mgbe niile, họrọ ụdị nwere nguzogide ọrịa, ma belata nrụgide ihe ọkụkụ site nlekọta ugbo ọma.",
    },
    northernLeafBlight: {
      title: "Ọkụ akwụkwọ ugwu",
      description: "Ọrịa fungi nwere ntụpọ ogologo acha akwụkwọ ndụ-toka nke na-ebelata mkpụrụ.",
      treatment: "Tinye ọgwụ fungi akwụkwọ akwadoro mgbe ọrịa na-arụ ọrụ ma na-arịgo n'elu osisi.",
      prevention: "Jiri ụdị nwere nguzogide siri ike, gbanwee ihe ọkụkụ ma ọ bụrụ na o kwere, ma lekọta fọdụrụnụ ọka n'ubi.",
    },
    commonRust: {
      title: "Nchara nkịtị",
      description: "Pustule uhie-aja aja nke fungi na-akpata n'akụkụ abụọ nke akwụkwọ.",
      treatment: "Ọ bụrụ na nchara na-abawanye n'oge mbụ, tinye ọgwụ fungi akwụkwọ mgbe pustule ka dị ole na ole.",
      prevention: "Buru ụzọ họrọ ụdị nwere nguzogide, n'ihi na spores nchara na-abịakarị site n'èzí ubi.",
    },
    grayLeafSpot: {
      title: "Ntụpọ akwụkwọ isi awọ",
      description: "Ntụpọ isi awọ nke yiri akụkụ anọ ma na-agbasakarị n'akụkụ akwara akwụkwọ.",
      treatment: "Tinye ọgwụ fungi akwụkwọ ngwa ngwa mgbe ntụpọ akwụkwọ isi awọ na-arụ ọrụ, karịsịa mgbe ọ na-eru n'elu osisi.",
      prevention: "Jiri ụdị nwere nguzogide, zere ịkụ ọka n'otu ebe mgbe niile ma ọ bụrụ na o kwere, ma lekọta fọdụrụnụ ọka.",
    },
    unknown: {
      title: "Ajụrụ foto",
      description: "Foto a adịghị ka ihe model mụtara banyere ọrịa ọka n'ụzọ a pụrụ ịtụkwasị obi.",
      treatment: "Were foto ọzọ ka otu akwụkwọ ọka juo ọtụtụ akụkụ foto. Zere blur, onyinyo siri ike, na ihe ndabere na-enweghị njikọ.",
      prevention: "Jiri foto ubi doro anya nke akwụkwọ ọka site n'ihu, ma tinye foto na-abụghị ọka n'ọzụzụ ma ọ bụrụ na ịchọrọ ka model jụ ha.",
    },
    recommendationUnavailable: {
      title: "Ndụmọdụ adịghị",
      description: "Amụma laghachiri, mana enweghị ndụmọdụ ọrịa n'ime nzaghachi.",
      treatment: "Gbaa nsonaazụ ahụ ajụjụ n'aka ọkachamara ugbo ma ọ bụ isi mmụta tupu ime ihe.",
      prevention: "Na-enyocha ihe ọkụkụ ma jiri ndụmọdụ njikwa ọrịa nke mpaghara gị.",
    },
  },
};

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  formatDateTime: (value: string | Date) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.some((language) => language.code === stored) ? (stored as LanguageCode) : "en";
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<LanguageCode>(() => getStoredLanguage());

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = dictionaries[language]["document.title"] ?? dictionaries.en["document.title"];
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, values: Record<string, string | number> = {}) => {
      const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
      return Object.entries(values).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
        template,
      );
    };

    const formatDateTime = (valueToFormat: string | Date) =>
      new Intl.DateTimeFormat(localeByLanguage[language], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(valueToFormat));

    return { language, setLanguage, t, formatDateTime };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}

function normalizeClassName(className: string) {
  return className
    .replace("Corn_(maize)___", "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function getDiseaseKey(value: string): DiseaseKey | null {
  const normalized = normalizeClassName(value);

  if (normalized.includes("recommendation unavailable")) return "recommendationUnavailable";
  if (normalized.includes("image rejected") || normalized.includes("unknown")) return "unknown";
  if (normalized.includes("healthy")) return "healthy";
  if (normalized.includes("northern")) return "northernLeafBlight";
  if (normalized.includes("common rust")) return "commonRust";
  if (normalized.includes("gray") || normalized.includes("cercospora")) return "grayLeafSpot";

  return null;
}

export function getDiseaseDetails(className: string, language: LanguageCode) {
  const diseaseKey = getDiseaseKey(className);
  if (!diseaseKey) return undefined;

  const { title, description } = diseaseContent[language][diseaseKey];
  return { title, description };
}

export function translateClassLabel(className: string, language: LanguageCode) {
  return getDiseaseDetails(className, language)?.title ?? normalizeClassName(className);
}

export function getFallbackGuidance(language: LanguageCode) {
  return diseaseContent[language].recommendationUnavailable;
}

export function translateGuidance(
  guidance: LocalizedGuidance | undefined,
  className: string,
  language: LanguageCode,
) {
  const diseaseKey = getDiseaseKey(guidance?.title ?? "") ?? getDiseaseKey(className);
  if (diseaseKey) {
    return diseaseContent[language][diseaseKey];
  }

  return guidance ?? getFallbackGuidance(language);
}
