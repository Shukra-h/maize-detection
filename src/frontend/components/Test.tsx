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
import { useEffect, useRef, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

interface PredictionResult {
  success: boolean;
  prediction: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  filename: string;
}

const CLASS_DETAILS: Record<string, { title: string; description: string }> = {
  healthy: {
    title: "Healthy Leaf",
    description: "No visible signs of major maize leaf disease.",
  },
  "Northern Leaf Blight": {
    title: "Northern Leaf Blight",
    description: "Fungal disease with elongated gray-green lesions that reduce yield.",
  },
  "Common rust": {
    title: "Common Rust",
    description: "Reddish-brown pustules caused by rust fungi on both leaf surfaces.",
  },
  "Cercospora leaf spot Gray Leaf Spot": {
    title: "Gray Leaf Spot",
    description: "Rectangular gray lesions that often expand along leaf veins.",
  },
};

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

const Demo = () => {
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const selectedFile = e.target.files[0];
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setImage(selectedFile);
    setResult(null);
    setError(null);
  };

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handlePredict = async () => {
    if (!image) {
      setError("Please select an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", image);

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Prediction failed";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Prediction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const topLabel = result ? formatClassName(result.prediction) : "";
  const topDetail = topLabel ? CLASS_DETAILS[topLabel] : undefined;

  return (
    <Box
      minH="100vh"
      px={{ base: 3, sm: 4, md: 8 }}
      py={{ base: 4, sm: 6, md: 10 }}
      bg="linear-gradient(160deg, #f2f8f0 0%, #eef6fa 52%, #ffffff 100%)"
    >
      <VStack gap={{ base: 4, md: 6 }} maxW="1100px" mx="auto" align="stretch">
        <Box
          border="1px solid"
          borderColor="blackAlpha.100"
          bg="whiteAlpha.880"
          borderRadius={{ base: "xl", md: "2xl" }}
          p={{ base: 4, sm: 5, md: 8 }}
          boxShadow="0 8px 32px rgba(16, 24, 40, 0.08)"
        >
          <Text fontSize="xs" letterSpacing={{ base: "0.12em", md: "0.16em" }} textTransform="uppercase" color="green.700" mb={2}>
            AI Crop Health Scanner
          </Text>
          <Text fontSize={{ base: "xl", sm: "2xl", md: "4xl" }} fontWeight="bold" lineHeight="1.05" color="gray.900">
            Maize Leaf Disease Detection
          </Text>
          <Text mt={3} maxW="800px" color="gray.700" fontSize={{ base: "sm", md: "md" }}>
            Upload a clear maize leaf image to detect common diseases including Gray Leaf Spot,
            Common Rust, and Northern Leaf Blight.
          </Text>
        </Box>

        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", lg: "1.1fr 1fr" }}
          gap={{ base: 4, md: 6 }}
        >
          <VStack
            align="stretch"
            gap={{ base: 3, md: 4 }}
            p={{ base: 3, sm: 4, md: 6 }}
            border="1px solid"
            borderColor="blackAlpha.100"
            bg="white"
            borderRadius="xl"
            boxShadow="sm"
          >
            <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="gray.800">
              1) Upload Leaf Image
            </Text>
            <Stack direction={{ base: "column", sm: "row" }} gap={3} align={{ base: "stretch", sm: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              <Button
                variant="outline"
                colorScheme="green"
                borderWidth="2px"
                onClick={() => fileInputRef.current?.click()}
                w={{ base: "100%", sm: "auto" }}
              >
                Choose File
              </Button>
              <Text fontSize="sm" color="gray.600" lineClamp="1" minW={0}>
                {image?.name || "No file selected"}
              </Text>
            </Stack>

            <Box
              minH={{ base: "220px", sm: "260px", md: "280px" }}
              borderRadius="lg"
              border="1px dashed"
              borderColor="gray.300"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              bg="gray.50"
            >
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Selected maize leaf"
                  objectFit="cover"
                  w="100%"
                  h="100%"
                  maxH={{ base: "320px", md: "420px" }}
                />
              ) : (
                <Text color="gray.500" fontSize="sm" textAlign="center" px={6}>
                  A preview will appear here once an image is selected.
                </Text>
              )}
            </Box>

            <Stack direction={{ base: "column", sm: "row" }} gap={3}>
              <Button
                colorScheme="green"
                onClick={handlePredict}
                disabled={!image || loading}
                loading={loading}
                loadingText="Analyzing"
                w={{ base: "100%", sm: "auto" }}
              >
                Analyze Image
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!image && !result && !error}
                w={{ base: "100%", sm: "auto" }}
              >
                Reset
              </Button>
            </Stack>

            {loading && (
              <HStack gap={2} color="gray.700" align="start">
                <Spinner size="sm" color="green.600" />
                <Text fontSize="sm" lineHeight="1.4">
                  Running model inference on the uploaded leaf...
                </Text>
              </HStack>
            )}

            {error && (
              <Alert.Root status="error" borderRadius="md">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Prediction failed</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
          </VStack>

          <VStack
            align="stretch"
            gap={{ base: 3, md: 4 }}
            p={{ base: 3, sm: 4, md: 6 }}
            border="1px solid"
            borderColor="blackAlpha.100"
            bg="white"
            borderRadius="xl"
            boxShadow="sm"
          >
            <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="gray.800">
              2) Analysis Result
            </Text>

            {!result && !loading && (
              <Box borderRadius="lg" bg="gray.50" p={5}>
                <Text fontSize="sm" color="gray.600">
                  Results will appear here after analysis, including confidence scores for all classes.
                </Text>
              </Box>
            )}

            {result && (
              <VStack align="stretch" gap={4}>
                <Box p={4} borderRadius="lg" bg="green.50" border="1px solid" borderColor="green.100">
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.14em" color="green.700">
                    Primary Detection
                  </Text>
                  <Text mt={1} fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" color="gray.900">
                    {topDetail?.title || topLabel}
                  </Text>
                  <Text mt={2} fontSize="sm" color="gray.700">
                    {topDetail?.description || "Detected class from the trained maize model."}
                  </Text>
                  <Text mt={3} fontSize="md" fontWeight="semibold" color={getConfidenceColor(result.confidence)}>
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </Text>
                </Box>

                <Box>
                  <Text fontSize="sm" color="gray.700" mb={2}>
                    All predictions
                  </Text>
                  <VStack gap={2} align="stretch">
                    {Object.entries(result.all_probabilities)
                      .sort(([, a], [, b]) => b - a)
                      .map(([className, probability]) => {
                        const label = formatClassName(className);
                        const isTop = className === result.prediction;
                        const width = `${Math.min(100, Math.max(0, probability * 100)).toFixed(1)}%`;

                        return (
                          <Box
                            key={className}
                            p={3}
                            borderRadius="md"
                            border="1px solid"
                            borderColor={isTop ? "green.200" : "gray.200"}
                            bg={isTop ? "green.50" : "gray.50"}
                          >
                            <Stack direction={{ base: "column", sm: "row" }} justify="space-between" mb={2} gap={1}>
                              <Text fontSize="sm" fontWeight={isTop ? "semibold" : "medium"} color="gray.800" lineHeight="1.3">
                                {label}
                              </Text>
                              <Text fontSize="sm" color="gray.700" whiteSpace="nowrap">
                                {(probability * 100).toFixed(1)}%
                              </Text>
                            </Stack>
                            <Box h="6px" borderRadius="full" bg="gray.200" overflow="hidden">
                              <Box
                                h="100%"
                                borderRadius="full"
                                bg={isTop ? "green.500" : "blue.400"}
                                w={width}
                              />
                            </Box>
                          </Box>
                        );
                      })}
                  </VStack>
                </Box>
              </VStack>
            )}
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default Demo;
