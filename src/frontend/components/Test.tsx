import { Input, HStack, Box, Button, VStack, Text, Spinner, Alert, AlertTitle, AlertDescription } from "@chakra-ui/react"
import { Image } from "@chakra-ui/react";
import { useState } from "react"

// API Configuration
const API_URL = "/api/"; // Your FastAPI backend URL

interface PredictionResult {
  success: boolean;
  prediction: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  filename: string;
}

const Demo = () => {
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      // Reset previous results when new image is selected
      setResult(null);
      setError(null);
    }
  };

  const handlePredict = async () => {
    if (!image) {
      setError("Please select an image first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create FormData to send image
      const formData = new FormData();
      formData.append("file", image);

      // Send request to FastAPI backend
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Prediction failed");
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

  const formatClassName = (className: string) => {
    // Clean up class name for display
    return className
      .replace("Corn_(maize)___", "")
      .replace(/_/g, " ")
      .replace("Gray leaf spot", "Gray Leaf Spot");
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "green.500";
    if (confidence >= 0.6) return "yellow.500";
    return "red.500";
  };

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      flexDirection="column" 
      alignItems="center" 
      w="100%" 
      mt={10}
      px={4}
    >
      <VStack gap={6} w="100%" maxW="600px">
        {/* Title */}
        <Text fontSize="2xl" fontWeight="bold">
          Maize Disease Detection
        </Text>

        {/* File Upload */}
        <HStack justify="center" w="100%">
          <Input 
            type="file" 
            accept="image/*" 
            onChange={handleImageChange}
            p={1}
          />
        </HStack>

        {/* Image Preview */}
        {image && (
          <Box position="relative">
            <Image
              src={URL.createObjectURL(image)}
              alt="preview"
              mt={4}
              maxW="256px"
              maxH="256px"
              objectFit="cover"
              borderRadius="lg"
              boxShadow="md"
            />
          </Box>
        )}

        {/* Predict Button */}
        {image && !result && (
          <Button
            colorScheme="blue"
            size="lg"
            onClick={handlePredict}
            loading={loading}
            loadingText="Analyzing..."
            w="200px"
          >
            Analyze Image
          </Button>
        )}

        {/* Loading Spinner */}
        {loading && (
          <HStack gap={3}>
            <Spinner size="md" color="blue.500" />
            <Text>Analyzing corn leaf...</Text>
          </HStack>
        )}

        {/* Error Message */}
        {error && (
          <Alert.Root status="error" borderRadius="md">
            <Alert.Indicator />
            <Alert.Title>Error!</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        )}

        {/* Prediction Results */}
        {result && (
          <VStack 
            gap={4} 
            w="100%" 
            p={6} 
            bg="gray.50" 
            borderRadius="lg" 
            boxShadow="md"
          >
            <Text fontSize="xl" fontWeight="bold">
              Prediction Results
            </Text>

            {/* Main Prediction */}
            <Box w="100%" p={4} bg="white" borderRadius="md" boxShadow="sm">
              <Text fontSize="sm" color="gray.600" mb={1}>
                Detected Disease:
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                {formatClassName(result.prediction)}
              </Text>
              <Text 
                fontSize="lg" 
                fontWeight="semibold" 
                color={getConfidenceColor(result.confidence)}
                mt={2}
              >
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </Text>
            </Box>

            {/* All Probabilities */}
            <Box w="100%">
              <Text fontSize="md" fontWeight="semibold" mb={2}>
                All Predictions:
              </Text>
              <VStack gap={2} w="100%">
                {Object.entries(result.all_probabilities)
                  .sort(([, a], [, b]) => b - a)
                  .map(([className, probability]) => (
                    <Box 
                      key={className} 
                      w="100%" 
                      p={3} 
                      bg="white" 
                      borderRadius="md"
                      borderLeft="4px"
                      borderColor={className === result.prediction ? "blue.500" : "gray.200"}
                    >
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight={className === result.prediction ? "bold" : "normal"}>
                          {formatClassName(className)}
                        </Text>
                        <Text 
                          fontSize="sm" 
                          color={className === result.prediction ? "blue.600" : "gray.600"}
                          fontWeight={className === result.prediction ? "bold" : "normal"}
                        >
                          {(probability * 100).toFixed(1)}%
                        </Text>
                      </HStack>
                    </Box>
                  ))}
              </VStack>
            </Box>

            {/* Try Another Button */}
            <Button
              colorScheme="gray"
              variant="outline"
              onClick={() => {
                setImage(null);
                setResult(null);
                setError(null);
              }}
              w="200px"
            >
              Analyze Another Image
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  )
}

export default Demo