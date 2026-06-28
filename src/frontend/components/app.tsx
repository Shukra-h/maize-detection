import {
  Alert,
  Box,
  Button,
  HStack,
  Stack,
  Spinner,
  Text,
  VStack,
  Image,
} from "@chakra-ui/react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  deleteDetectionHistoryItem,
  getDetectionHistory,
  pruneDetectionHistory,
  saveDetectionHistoryItem,
  type DetectionFeedbackMetadata,
  type DetectionHistoryRecord,
  type FeedbackAdjustedPrediction,
  type PredictionDecision,
  type PredictionGuidance,
} from "./detectionHistory";
import {
  getDiseaseDetails,
  getFallbackGuidance,
  translateClassLabel,
  translateGuidance,
  useI18n,
} from "./i18n";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const HISTORY_LIMIT = 20;

interface PredictionResult {
  success: boolean;
  accepted?: boolean;
  prediction: string;
  model_prediction?: string;
  decision?: PredictionDecision;
  confidence: number;
  all_probabilities: Record<string, number>;
  guidance?: PredictionGuidance;
  filename: string;
  prediction_id?: string;
  image_hash?: string;
  feedback_adjusted?: boolean | FeedbackAdjustedPrediction;
  feedback_adjusted_prediction?: string;
  feedback_adjusted_confidence?: number;
  feedback_adjusted_decision?: PredictionDecision;
}

interface DetectionHistoryItem extends DetectionHistoryRecord {
  previewUrl: string;
}

interface DemoProps {
  session?: Session | null;
}

type ActiveImageSource = "upload" | "history" | null;
type FeedbackAnswer = "yes" | "no";
type FeedbackStatus = "idle" | "submitting" | "submitted" | "submitted-api-only" | "error";

const FEEDBACK_CLASS_OPTIONS = [
  "Corn_(maize)___healthy",
  "Corn_(maize)___Common_rust_",
  "Corn_(maize)___Northern_Leaf_Blight",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
  "unknown_unclassified",
];

const formatClassName = (className: string) =>
  className
    .replace("Corn_(maize)___", "")
    .replace(/_/g, " ")
    .replace("Gray leaf spot", "Gray Leaf Spot")
    .trim();

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return "green.500";
  if (confidence >= 0.6) return "orange.500";
  return "red.500";
};

const getConfidenceTone = (confidence: number) => {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
};

const createHistoryId = () =>
  `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

const getFeedbackAdjustedPayload = (
  result: Pick<PredictionResult, "feedback_adjusted">,
) => (typeof result.feedback_adjusted === "object" ? result.feedback_adjusted : undefined);

const isFeedbackAdjustedResult = (
  result: Pick<PredictionResult, "feedback_adjusted" | "feedback_adjusted_prediction">,
) => Boolean(
  result.feedback_adjusted === true ||
  getFeedbackAdjustedPayload(result)?.applied === true ||
  result.feedback_adjusted_prediction,
);

const getDisplayPrediction = (
  result: Pick<PredictionResult, "prediction" | "feedback_adjusted" | "feedback_adjusted_prediction">,
) =>
  getFeedbackAdjustedPayload(result)?.adjusted_prediction ??
  getFeedbackAdjustedPayload(result)?.corrected_label ??
  result.feedback_adjusted_prediction ??
  result.prediction;

const getDisplayConfidence = (
  result: Pick<PredictionResult, "confidence" | "feedback_adjusted" | "feedback_adjusted_confidence">,
) =>
  getFeedbackAdjustedPayload(result)?.adjusted_confidence ??
  result.feedback_adjusted_confidence ??
  result.confidence;

const getRawModelPrediction = (
  result: Pick<PredictionResult, "prediction" | "model_prediction">,
) => result.model_prediction ?? result.prediction;

const buildAuthHeaders = (session?: Session | null): HeadersInit | undefined =>
  session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;

const buildResultFromHistory = (item: DetectionHistoryRecord): PredictionResult => ({
  success: true,
  accepted: item.accepted,
  prediction: item.prediction,
  model_prediction: item.model_prediction,
  decision: item.decision,
  confidence: item.confidence,
  all_probabilities: item.all_probabilities,
  guidance: item.guidance,
  filename: item.filename,
  prediction_id: item.prediction_id,
  image_hash: item.image_hash,
  feedback_adjusted: item.feedback_adjusted,
  feedback_adjusted_prediction: item.feedback_adjusted_prediction,
  feedback_adjusted_confidence: item.feedback_adjusted_confidence,
  feedback_adjusted_decision: item.feedback_adjusted_decision,
});

const Demo = ({ session = null }: DemoProps) => {
  const { language, t, formatDateTime } = useI18n();
  const [image, setImage] = useState<File | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [activeImageSource, setActiveImageSource] = useState<ActiveImageSource>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<DetectionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeHistoryRecord, setActiveHistoryRecord] = useState<DetectionHistoryRecord | null>(null);
  const [feedbackAnswer, setFeedbackAnswer] = useState<FeedbackAnswer | null>(null);
  const [feedbackCorrectClass, setFeedbackCorrectClass] = useState("");
  const [feedbackTrainingConsent, setFeedbackTrainingConsent] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historyPreviewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!previewAsset) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(previewAsset);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [previewAsset]);

  const applyHistoryRecords = (records: DetectionHistoryRecord[]) => {
    historyPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));

    const nextItems = records.map((record) => ({
      ...record,
      previewUrl: URL.createObjectURL(record.imageBlob),
    }));

    historyPreviewUrlsRef.current = nextItems.map((item) => item.previewUrl);
    setHistoryItems(nextItems);
  };

  const applyFeedbackMetadata = (feedback?: DetectionFeedbackMetadata) => {
    setFeedbackAnswer(
      feedback ? (feedback.wasPredictionCorrect ? "yes" : "no") : null,
    );
    setFeedbackCorrectClass(feedback?.correctClass ?? "");
    setFeedbackTrainingConsent(Boolean(feedback?.trainingConsent));
    setFeedbackStatus(feedback ? "submitted" : "idle");
    setFeedbackError(null);
  };

  const clearFeedbackState = () => {
    setFeedbackAnswer(null);
    setFeedbackCorrectClass("");
    setFeedbackTrainingConsent(false);
    setFeedbackStatus("idle");
    setFeedbackError(null);
  };

  const handleFeedbackAnswerChange = (answer: FeedbackAnswer) => {
    setFeedbackAnswer(answer);
    if (answer === "yes") {
      setFeedbackCorrectClass("");
    }
    setFeedbackStatus("idle");
    setFeedbackError(null);
  };

  const handleFeedbackClassChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFeedbackCorrectClass(event.target.value);
    setFeedbackStatus("idle");
    setFeedbackError(null);
  };

  const loadHistory = useEffectEvent(async () => {
    setHistoryLoading(true);

    try {
      const records = await getDetectionHistory();
      applyHistoryRecords(records);
      setHistoryError(null);
    } catch (historyLoadError) {
      applyHistoryRecords([]);
      setHistoryError(
        historyLoadError instanceof Error
          ? historyLoadError.message
          : t("detector.errorHistoryLoad"),
      );
    } finally {
      setHistoryLoading(false);
    }
  });

  useEffect(() => {
    void loadHistory();

    return () => {
      historyPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      historyPreviewUrlsRef.current = [];
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const selectedFile = e.target.files[0];
    e.target.value = "";

    if (!selectedFile.type.startsWith("image/")) {
      setError(t("detector.errorInvalidImage"));
      return;
    }

    setImage(selectedFile);
    setPreviewAsset(selectedFile);
    setSelectedFileName(selectedFile.name);
    setActiveImageSource("upload");
    setResult(null);
    setActiveHistoryRecord(null);
    clearFeedbackState();
    setError(null);
  };

  const handleReset = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setImage(null);
    setPreviewAsset(null);
    setSelectedFileName(null);
    setActiveImageSource(null);
    setResult(null);
    setActiveHistoryRecord(null);
    clearFeedbackState();
    setError(null);
    setLoading(false);
  };

  const handleHistoryRestore = (item: DetectionHistoryItem) => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setImage(null);
    setPreviewAsset(item.imageBlob);
    setSelectedFileName(item.filename);
    setActiveImageSource("history");
    setResult(buildResultFromHistory(item));
    setActiveHistoryRecord(item);
    applyFeedbackMetadata(item.feedback);
    setError(null);
    setLoading(false);
  };

  const handleHistoryDelete = async (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();

    try {
      await deleteDetectionHistoryItem(id);
      await loadHistory();
      setHistoryError(null);
    } catch (deleteError) {
      setHistoryError(
        deleteError instanceof Error
          ? deleteError.message
          : t("detector.errorHistoryDelete"),
      );
    }
  };

  const handlePredict = async () => {
    if (!image) {
      setError(t("detector.errorSelectImage"));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveHistoryRecord(null);
    clearFeedbackState();

    try {
      const formData = new FormData();
      formData.append("file", image);

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: buildAuthHeaders(session),
        body: formData,
      });

      if (!response.ok) {
        let message = t("detector.errorPredictionGeneric");
        try {
          const errorData = await response.json();
          message = errorData.detail || message;
        } catch {
          // Keep fallback message if response isn't JSON.
        }
        throw new Error(message);
      }

      const data: PredictionResult = await response.json();
      setResult(data);

      try {
        const historyRecord: DetectionHistoryRecord = {
          id: createHistoryId(),
          createdAt: new Date().toISOString(),
          filename: image.name,
          imageBlob: image,
          prediction_id: data.prediction_id,
          image_hash: data.image_hash,
          accepted: data.accepted,
          prediction: data.prediction,
          model_prediction: data.model_prediction ?? data.prediction,
          decision: data.decision,
          confidence: data.confidence,
          all_probabilities: data.all_probabilities,
          guidance: data.guidance,
          feedback_adjusted: data.feedback_adjusted,
          feedback_adjusted_prediction: data.feedback_adjusted_prediction,
          feedback_adjusted_confidence: data.feedback_adjusted_confidence,
          feedback_adjusted_decision: data.feedback_adjusted_decision,
        };

        await saveDetectionHistoryItem(historyRecord);
        setActiveHistoryRecord(historyRecord);
        await pruneDetectionHistory(HISTORY_LIMIT);
        await loadHistory();
      } catch (historySaveError) {
        setHistoryError(
          historySaveError instanceof Error
            ? historySaveError.message
            : t("detector.errorHistorySave"),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detector.errorGeneric"));
      console.error("Prediction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!result) return;

    if (!feedbackAnswer) {
      setFeedbackStatus("error");
      setFeedbackError(t("detector.feedbackErrorChooseAnswer"));
      return;
    }

    if (feedbackAnswer === "no" && !feedbackCorrectClass) {
      setFeedbackStatus("error");
      setFeedbackError(t("detector.feedbackErrorChooseClass"));
      return;
    }

    setFeedbackStatus("submitting");
    setFeedbackError(null);

    const submittedAt = new Date().toISOString();
    const wasPredictionCorrect = feedbackAnswer === "yes";
    const displayPrediction = getDisplayPrediction(result);
    const correctedClass = wasPredictionCorrect ? displayPrediction : feedbackCorrectClass;
    const displayConfidence = getDisplayConfidence(result);
    const modelPrediction = getRawModelPrediction(result);
    const feedbackAdjusted = isFeedbackAdjustedResult(result);
    const predictionId = result.prediction_id ?? activeHistoryRecord?.prediction_id;
    const imageHash = result.image_hash ?? activeHistoryRecord?.image_hash;

    const feedback: DetectionFeedbackMetadata = {
      submittedAt,
      wasPredictionCorrect,
      correctClass: wasPredictionCorrect ? undefined : correctedClass,
      predictedClass: displayPrediction,
      modelPrediction,
      decision: result.decision,
      feedbackAdjusted,
      trainingConsent: feedbackTrainingConsent,
    };

    try {
      const feedbackFormData = new FormData();
      feedbackFormData.append("payload", JSON.stringify({
        prediction_id: predictionId,
        image_hash: imageHash,
        corrected_label: correctedClass,
        is_correct: wasPredictionCorrect,
        training_consent: feedbackTrainingConsent,
      }));

      if (feedbackTrainingConsent) {
        const consentImage = image ?? activeHistoryRecord?.imageBlob ?? previewAsset;
        if (consentImage) {
          feedbackFormData.append(
            "file",
            consentImage,
            selectedFileName ?? result.filename ?? activeHistoryRecord?.filename ?? "feedback-image.png",
          );
        }
      }

      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: buildAuthHeaders(session),
        body: feedbackFormData,
      });

      if (!response.ok) {
        let message = t("detector.feedbackErrorGeneric");
        try {
          const errorData = await response.json();
          message =
            typeof errorData.detail === "string"
              ? errorData.detail
              : errorData.detail?.message || message;
        } catch {
          // Keep fallback message if response isn't JSON.
        }
        throw new Error(message);
      }

      if (!activeHistoryRecord) {
        setFeedbackStatus("submitted-api-only");
        return;
      }

      try {
        const updatedRecord: DetectionHistoryRecord = {
          ...activeHistoryRecord,
          feedback,
        };

        await saveDetectionHistoryItem(updatedRecord);
        setActiveHistoryRecord(updatedRecord);
        await loadHistory();
        setFeedbackStatus("submitted");
      } catch (historySaveError) {
        setFeedbackStatus("submitted-api-only");
        setHistoryError(
          historySaveError instanceof Error
            ? historySaveError.message
            : t("detector.errorHistorySave"),
        );
      }
    } catch (feedbackSubmitError) {
      setFeedbackStatus("error");
      setFeedbackError(
        feedbackSubmitError instanceof Error
          ? feedbackSubmitError.message
          : t("detector.feedbackErrorGeneric"),
      );
    }
  };

  const getFeedbackClassLabel = (className: string) => {
    if (className === "unknown_unclassified") {
      return t("detector.feedbackClassUnknown");
    }

    return translateClassLabel(formatClassName(className), language);
  };

  const displayPrediction = result ? getDisplayPrediction(result) : "";
  const displayConfidence = result ? getDisplayConfidence(result) : 0;
  const feedbackConsentImage = image ?? activeHistoryRecord?.imageBlob ?? previewAsset;
  const topLabel = result ? formatClassName(displayPrediction) : "";
  const isFeedbackSubmitDisabled =
    feedbackStatus === "submitting" ||
    !feedbackAnswer ||
    (feedbackAnswer === "no" && !feedbackCorrectClass) ||
    (feedbackTrainingConsent && !feedbackConsentImage);
  const fallbackGuidance = getFallbackGuidance(language);
  const topDetail = topLabel ? getDiseaseDetails(topLabel, language) : undefined;
  const isHistoryPreview = activeImageSource === "history";
  const guidance = result?.guidance
    ? translateGuidance(result.guidance, topLabel, language)
    : result
      ? {
          ...fallbackGuidance,
          title: topDetail?.title || (topLabel ? translateClassLabel(topLabel, language) : fallbackGuidance.title),
          description: topDetail?.description || fallbackGuidance.description,
        }
      : undefined;

  return (
    <Box
      className="detector-workspace"
      minH="100vh"
      px={{ base: 3, sm: 4, md: 8 }}
      py={{ base: 4, sm: 6, md: 10 }}
    >
      <VStack className="detector-shell" gap={{ base: 4, md: 6 }} maxW="1120px" mx="auto" align="stretch">
        <Box
          className="detector-grid"
          display="grid"
          gridTemplateColumns={{ base: "1fr", lg: "1.1fr 1fr" }}
          gap={{ base: 4, md: 6 }}
          alignItems="start"
        >
          <VStack
            className="detector-column detector-column--input"
            gap={{ base: 4, md: 6 }}
            align="stretch"
            display={{ base: "contents", lg: "flex" }}
          >
            <VStack
              className="detector-panel detector-panel--upload"
              align="stretch"
              gap={{ base: 3, md: 4 }}
              p={{ base: 3, sm: 4, md: 6 }}
              order={{ base: 1, lg: 0 }}
            >
              <Text className="detector-panel-title">
                {t("detector.uploadTitle")}
              </Text>
              <Stack className="detector-file-row" direction={{ base: "column", sm: "row" }} gap={3} align={{ base: "stretch", sm: "center" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
	                <Button
	                  className="detector-secondary-action"
	                  variant="outline"
	                  onClick={() => {
	                    if (fileInputRef.current) {
	                      fileInputRef.current.value = "";
	                      fileInputRef.current.click();
	                    }
	                  }}
	                  w={{ base: "100%", sm: "auto" }}
	                >
                  {t("detector.chooseFile")}
                </Button>
                <Text className="detector-file-name" lineClamp="1" minW={0}>
                  {selectedFileName || t("detector.noFile")}
                </Text>
              </Stack>

              <Box
                className={`detector-specimen-tray${previewUrl ? " detector-specimen-tray--filled" : ""}`}
                minH={{ base: "220px", sm: "260px", md: "280px" }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
              >
                {previewUrl ? (
                  <Image
                    className="detector-specimen-image"
                    src={previewUrl}
                    alt={t("detector.previewAlt")}
                    objectFit="cover"
                    w="100%"
                    h="100%"
                    maxH={{ base: "320px", md: "420px" }}
                  />
                ) : (
                  <Text className="detector-empty-copy" textAlign="center" px={6}>
                    {t("detector.previewEmpty")}
                  </Text>
                )}
              </Box>

              <Stack className="detector-action-row" direction={{ base: "column", sm: "row" }} gap={3}>
                <Button
                  className="detector-primary-action"
                  onClick={handlePredict}
                  disabled={!image || loading || isHistoryPreview}
                  // loading={loading}
                  loadingText={t("detector.analyzing")}
                  w={{ base: "100%", sm: "auto" }}
                >
                  {t("detector.analyze")}
                </Button>
                <Button
                  className="detector-secondary-action"
                  variant="outline"
                  onClick={handleReset}
                  disabled={!image && !result && !error}
                  w={{ base: "100%", sm: "auto" }}
                >
                  {t("detector.reset")}
                </Button>
              </Stack>

              {loading && (
                <HStack className="detector-status-note" gap={2} align="start">
                  <Spinner size="sm" color="green.600" />
                  <Text>
                    {t("detector.runningInference")}
                  </Text>
                </HStack>
              )}

              {isHistoryPreview && !loading && (
                <Box className="detector-note" p={3}>
                  <Text>
                    {t("detector.historyPreview")}
                  </Text>
                </Box>
              )}

              {error && (
                <Alert.Root className="detector-alert" status="error" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t("detector.predictionFailed")}</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}
            </VStack>

            <VStack
              className="detector-panel detector-panel--guidance"
              align="stretch"
              gap={{ base: 3, md: 4 }}
              p={{ base: 3, sm: 4, md: 6 }}
              order={{ base: 3, lg: 0 }}
            >
              <Text className="detector-panel-title">
                {t("detector.guidanceTitle")}
              </Text>

              {!guidance && !loading && (
                <Box className="detector-empty-state" p={5}>
                  <Text>
                    {t("detector.guidanceEmpty")}
                  </Text>
                </Box>
              )}

              {guidance && (
                <VStack align="stretch" gap={4}>
                  <Box
                    className="detector-guidance-card detector-guidance-card--treatment"
                    p={4}
                  >
                    <Text className="detector-mini-label">
                      {t("detector.treatment")}
                    </Text>
                    <Text className="detector-guidance-copy" mt={2}>
                      {guidance.treatment}
                    </Text>
                  </Box>

                  <Box
                    className="detector-guidance-card detector-guidance-card--prevention"
                    p={4}
                  >
                    <Text className="detector-mini-label">
                      {t("detector.prevention")}
                    </Text>
                    <Text className="detector-guidance-copy" mt={2}>
                      {guidance.prevention}
                    </Text>
                  </Box>
                </VStack>
              )}
            </VStack>
          </VStack>

          <VStack className="detector-column detector-column--output" gap={{ base: 4, md: 6 }} align="stretch" display={{ base: "contents", lg: "flex" }}>
            <VStack
              className="detector-panel detector-panel--result"
              align="stretch"
              gap={{ base: 3, md: 4 }}
              p={{ base: 3, sm: 4, md: 6 }}
              order={{ base: 2, lg: 0 }}
            >
              <Text className="detector-panel-title">
                {t("detector.resultTitle")}
              </Text>

              {!result && !loading && (
                <Box className="detector-empty-state" p={5}>
                  <Text>
                    {t("detector.resultEmpty")}
                  </Text>
                </Box>
              )}

              {result && (
                <VStack align="stretch" gap={4}>
	                  <Box className={`detector-primary-result detector-confidence--${getConfidenceTone(displayConfidence)}`} p={4}>
	                    <Text className="detector-mini-label">
	                      {t("detector.primaryDetection")}
	                    </Text>
                    <Text className="detector-result-title" mt={1}>
                      {guidance?.title || topDetail?.title || translateClassLabel(topLabel, language)}
                    </Text>
                    <Text className="detector-result-description" mt={2}>
                      {guidance?.description || topDetail?.description || t("detector.detectedClass")}
                    </Text>
	                    <Text className="detector-confidence-line" mt={3} color={getConfidenceColor(displayConfidence)}>
	                      {t("detector.confidence")}: {(displayConfidence * 100).toFixed(1)}%
	                    </Text>
                  </Box>

                  <Box>
                    <Text className="detector-subtitle" mb={2}>
                      {t("detector.allPredictions")}
                    </Text>
                    <VStack gap={2} align="stretch">
                      {Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([className, probability]) => {
                          const label = translateClassLabel(formatClassName(className), language);
                          const isTop = className === displayPrediction;
                          const width = `${Math.min(100, Math.max(0, probability * 100)).toFixed(1)}%`;

                          return (
                            <Box
                              className={`detector-probability-row${isTop ? " is-top" : ""}`}
                              key={className}
                              p={3}
                            >
                              <Stack direction={{ base: "column", sm: "row" }} justify="space-between" mb={2} gap={1}>
                                <Text className="detector-probability-label" fontWeight={isTop ? "semibold" : "medium"}>
                                  {label}
                                </Text>
                                <Text className="detector-probability-value" whiteSpace="nowrap">
                                  {(probability * 100).toFixed(1)}%
                                </Text>
                              </Stack>
                              <Box className="detector-probability-track" h="6px" overflow="hidden">
                                <Box
                                  className="detector-probability-fill"
                                  h="100%"
                                  w={width}
                                />
                              </Box>
                            </Box>
                          );
                        })}
                    </VStack>
                  </Box>

                  {!isHistoryPreview && (
                    <Box
                      as="form"
                      className="detector-feedback-form"
                      onSubmit={handleFeedbackSubmit}
                      p={4}
                    >
                      <Text className="detector-feedback-title">
                        {t("detector.feedbackTitle")}
                      </Text>
                      <Text className="detector-feedback-copy" mt={1}>
                        {t("detector.feedbackCopy")}
                      </Text>

                      <Box className="detector-feedback-options" mt={3}>
                        <label className={`detector-feedback-option${feedbackAnswer === "yes" ? " is-selected" : ""}`}>
                          <input
                            type="radio"
                            name="prediction-correct"
                            value="yes"
                            checked={feedbackAnswer === "yes"}
                            onChange={() => handleFeedbackAnswerChange("yes")}
                          />
                          <span>{t("detector.feedbackYes")}</span>
                        </label>
                        <label className={`detector-feedback-option${feedbackAnswer === "no" ? " is-selected" : ""}`}>
                          <input
                            type="radio"
                            name="prediction-correct"
                            value="no"
                            checked={feedbackAnswer === "no"}
                            onChange={() => handleFeedbackAnswerChange("no")}
                          />
                          <span>{t("detector.feedbackNo")}</span>
                        </label>
                      </Box>

                      {feedbackAnswer === "no" && (
                        <Box mt={3}>
                          <label className="detector-feedback-label" htmlFor="feedback-correct-class">
                            {t("detector.feedbackCorrectClassLabel")}
                          </label>
                          <select
                            id="feedback-correct-class"
                            className="detector-feedback-select"
                            value={feedbackCorrectClass}
                            onChange={handleFeedbackClassChange}
                          >
                            <option value="">
                              {t("detector.feedbackClassPlaceholder")}
                            </option>
                            {FEEDBACK_CLASS_OPTIONS.map((className) => (
                              <option key={className} value={className}>
                                {getFeedbackClassLabel(className)}
                              </option>
                            ))}
                          </select>
                        </Box>
                      )}

                      <Box mt={3}>
                        <label className={`detector-feedback-consent${feedbackTrainingConsent ? " is-selected" : ""}`}>
                          <input
                            type="checkbox"
                            checked={feedbackTrainingConsent}
                            onChange={(event) => {
                              setFeedbackTrainingConsent(event.target.checked);
                              setFeedbackStatus("idle");
                              setFeedbackError(null);
                            }}
                          />
                          <span>{t("detector.feedbackTrainingConsent")}</span>
                        </label>
                        <Text className="detector-feedback-consent-copy" mt={2}>
                          {t("detector.feedbackTrainingConsentCopy")}
                        </Text>
                      </Box>

                      <Button
                        className="detector-secondary-action"
                        type="submit"
                        loading={feedbackStatus === "submitting"}
                        loadingText={t("detector.feedbackSubmitting")}
                        disabled={isFeedbackSubmitDisabled}
                        mt={3}
                      >
                        {t("detector.feedbackSubmit")}
                      </Button>

                      {feedbackStatus === "submitted" && (
                        <Box className="detector-feedback-status" data-status="success" mt={3}>
                          <Text>{t("detector.feedbackSaved")}</Text>
                        </Box>
                      )}

                      {feedbackStatus === "submitted-api-only" && (
                        <Box className="detector-feedback-status" data-status="warning" mt={3}>
                          <Text>{t("detector.feedbackApiOnly")}</Text>
                        </Box>
                      )}

                      {feedbackStatus === "error" && feedbackError && (
                        <Box className="detector-feedback-status" data-status="error" mt={3}>
                          <Text>{feedbackError}</Text>
                        </Box>
                      )}
                    </Box>
                  )}
                </VStack>
              )}
            </VStack>

            <VStack
              className="detector-panel detector-panel--history"
              align="stretch"
              gap={{ base: 3, md: 4 }}
              p={{ base: 3, sm: 4, md: 6 }}
              order={{ base: 4, lg: 0 }}
            >
              <HStack className="detector-history-heading">
                <Text className="detector-panel-title">
                  {t("detector.historyTitle")}
                </Text>
                <span><Text className="detector-history-hint">{t("detector.historyHint")}</Text></span>
              </HStack>
              {historyItems.length > 0 && (
                <Text className="detector-history-count" as="span">
                  {historyItems.length} {t("detector.items")}
                </Text>
              )}

              {historyLoading && (
                <HStack className="detector-status-note" gap={2} align="start">
                  <Spinner size="sm" color="green.600" />
                  <Text>
                    {t("detector.loadingHistory")}
                  </Text>
                </HStack>
              )}

              {historyError && (
                <Alert.Root className="detector-alert" status="warning" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t("detector.historyUnavailable")}</Alert.Title>
                    <Alert.Description>{historyError}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}

              {!historyLoading && !historyItems.length && !historyError && (
                <Box className="detector-empty-state" p={5}>
                  <Text>
                    {t("detector.historyEmpty")}
                  </Text>
                </Box>
              )}

              {!historyLoading && historyItems.length > 0 && (
                <Box
                  maxH={historyItems.length > 3 ? { base: "480px", md: "540px" } : "none"}
                  overflowY={historyItems.length > 3 ? "auto" : "visible"}
                  pr={historyItems.length > 3 ? { base: 2, md: 4 } : 0}
                >
                  <VStack align="stretch" gap={3}>
	                    {historyItems.map((item) => {
	                      const itemPrediction = getDisplayPrediction(item);
	                      const itemConfidence = getDisplayConfidence(item);
	                      const itemGuidance = translateGuidance(item.guidance, itemPrediction, language);
                      const title = itemGuidance.title || translateClassLabel(formatClassName(itemPrediction), language);

                      return (
                        <Box
                          className="detector-history-item"
                          key={item.id}
                          textAlign="left"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleHistoryRestore(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleHistoryRestore(item);
                            }
                          }}
                          p={3}
                          cursor="pointer"
                        >
                          <Stack direction="row" gap={3} align="start">
                            <Box
                              className="detector-history-thumb"
                              flexShrink={0}
                              w={{ base: "76px", sm: "92px" }}
                              h={{ base: "76px", sm: "92px" }}
                              overflow="hidden"
                            >
                              <Image
                                src={item.previewUrl}
                                alt={item.filename}
                                objectFit="cover"
                                w="100%"
                                h="100%"
                              />
                            </Box>

                            <Box flex="1" minW={0}>
                              <Stack direction={{ base: "column", sm: "row" }} justify="space-between" align={{ base: "stretch", sm: "start" }} gap={2}>
                                <Box minW={0}>
                                  <Text className="detector-history-title">
                                    {title}
                                  </Text>
                                  <Text className="detector-history-filename" mt={1} lineClamp={1}>
                                    {item.filename}
                                  </Text>
                                </Box>

                                <Stack
                                  direction={{ base: "row", sm: "column" }}
                                  align={{ base: "center", sm: "end" }}
                                  justify={{ base: "space-between", sm: "start" }}
                                  gap={2}
                                  flexShrink={0}
                                  w={{ base: "100%", sm: "auto" }}
                                >
                                  <Text
                                    className="detector-history-date"
                                    whiteSpace={{ base: "normal", sm: "nowrap" }}
                                    textAlign={{ base: "left", sm: "right" }}
                                  >
                                    {formatDateTime(item.createdAt)}
                                  </Text>
                                  <Button
                                    className="detector-danger-action"
                                    size="xs"
                                    variant="outline"
                                    onClick={(event) => handleHistoryDelete(event, item.id)}
                                  >
                                    {t("detector.delete")}
                                  </Button>
                                </Stack>
                              </Stack>

	                              <Text className="detector-confidence-line" mt={2} color={getConfidenceColor(itemConfidence)}>
	                                {t("detector.confidence")}: {(itemConfidence * 100).toFixed(1)}%
	                              </Text>

                              <Text className="detector-history-treatment" mt={2} lineClamp={3}>
                                {itemGuidance.treatment || fallbackGuidance.treatment}
                              </Text>

                              {item.feedback && (
                                <Text className="detector-history-feedback" mt={2}>
                                  {item.feedback.wasPredictionCorrect
                                    ? t("detector.feedbackHistoryCorrect")
                                    : t("detector.feedbackHistoryCorrection", {
                                        class: getFeedbackClassLabel(item.feedback.correctClass ?? "unknown_unclassified"),
                                      })}
                                </Text>
                              )}
                            </Box>
                          </Stack>
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              )}
            </VStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default Demo;
