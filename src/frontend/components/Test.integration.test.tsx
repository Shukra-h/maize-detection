import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Demo from './app';
import { getDetectionHistory, saveDetectionHistoryItem } from './detectionHistory';
import { LanguageProvider } from './i18n';
import { Provider } from './ui/provider';

const fakeSession = {
  access_token: 'test-access-token',
} as unknown as Session;

const renderDetector = () =>
  render(
    <Provider>
      <LanguageProvider>
        <Demo session={fakeSession} />
      </LanguageProvider>
    </Provider>,
  );

const makeImageFile = (name = 'leaf.png') =>
  new File(['image-bytes'], name, { type: 'image/png' });

const uploadImage = async (file = makeImageFile()) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  await userEvent.upload(input!, file);
};

const changeFileInput = (file: File) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [file] } });
};

const expectExactTextContent = (text: string) => {
  expect(screen.getAllByText((_, node) => node?.textContent === text).length).toBeGreaterThan(0);
};

const mockPredictionResponse = (body: unknown, ok = true) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('detector integration flow', () => {
  it('shows validation feedback for non-image uploads', async () => {
    renderDetector();

    changeFileInput(new File(['notes'], 'notes.txt', { type: 'text/plain' }));

    expect(screen.getByText('Prediction failed')).toBeInTheDocument();
    expect(screen.getByText('Please upload a valid image file.')).toBeInTheDocument();
  });

  it('submits an uploaded image, displays the result, and saves history', async () => {
    const fetchMock = mockPredictionResponse({
      success: true,
      accepted: true,
      decision: 'accepted',
      prediction: 'Corn_(maize)___healthy',
      model_prediction: 'Corn_(maize)___healthy',
      confidence: 0.9123,
      all_probabilities: {
        'Corn_(maize)___healthy': 0.9123,
        'Corn_(maize)___Common_rust_': 0.04,
        'Corn_(maize)___Northern_Leaf_Blight': 0.03,
        'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': 0.01,
        unknown_unclassified: 0.0077,
      },
      guidance: {
        title: 'Healthy Leaf',
        description: 'No visible signs of major maize leaf disease.',
        treatment: 'No treatment is needed right now.',
        prevention: 'Maintain regular field scouting.',
      },
      filename: 'leaf.png',
    });

    renderDetector();
    await uploadImage(makeImageFile('leaf.png'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/predict');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer test-access-token',
    });
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
    expect(screen.getByText('Primary Detection')).toBeInTheDocument();
    expect(screen.getByText('All predictions')).toBeInTheDocument();
    expect(await screen.findAllByText('Healthy Leaf')).not.toHaveLength(0);
    expectExactTextContent('Confidence: 91.2%');
    expect(
      screen.getAllByText(
        'No treatment is needed right now. Keep scouting the field and respond quickly if new lesions or pustules begin to appear.',
      ).length,
    ).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getAllByText('leaf.png').length).toBeGreaterThanOrEqual(2));
  });

  it('displays rejected unknown predictions from the API', async () => {
    mockPredictionResponse({
      success: true,
      accepted: false,
      decision: 'rejected',
      prediction: 'Unknown / not confidently maize',
      model_prediction: 'unknown_unclassified',
      confidence: 0.88,
      all_probabilities: {
        unknown_unclassified: 0.88,
        'Corn_(maize)___healthy': 0.05,
        'Corn_(maize)___Common_rust_': 0.03,
        'Corn_(maize)___Northern_Leaf_Blight': 0.02,
        'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': 0.02,
      },
      guidance: {
        title: 'Image Rejected',
        description: 'This image does not look like a confident match.',
        treatment: 'Retake the photo so a single maize leaf fills most of the frame.',
        prevention: 'Use a clear field photo of a maize leaf from the front.',
      },
      filename: 'random.png',
    });

    renderDetector();
    await uploadImage(makeImageFile('random.png'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));

    expect(await screen.findAllByText('Image Rejected')).not.toHaveLength(0);
    expect(screen.getByText('Primary Detection')).toBeInTheDocument();
    expectExactTextContent('Confidence: 88.0%');
    expect(
      screen.getAllByText(
        'Retake the photo so a single maize leaf fills most of the frame. Avoid blur, heavy shadows, and unrelated background objects.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('loads previous detections and restores a history item', async () => {
    await saveDetectionHistoryItem({
      id: 'history-1',
      createdAt: '2026-05-18T09:00:00.000Z',
      filename: 'saved-leaf.png',
      imageBlob: makeImageFile('saved-leaf.png'),
      prediction: 'Corn_(maize)___Common_rust_',
      model_prediction: 'Corn_(maize)___Common_rust_',
      decision: 'accepted',
      confidence: 0.86,
      all_probabilities: {
        'Corn_(maize)___Common_rust_': 0.86,
        'Corn_(maize)___healthy': 0.14,
      },
      guidance: {
        title: 'Common Rust',
        description: 'Reddish-brown pustules caused by rust fungi.',
        treatment: 'If rust is increasing early, apply a labeled foliar fungicide.',
        prevention: 'Prioritize resistant hybrids first.',
      },
    });

    renderDetector();

    const historyItem = await screen.findByText('saved-leaf.png');
    await userEvent.click(historyItem);

    expect(screen.getAllByText('Common Rust').length).toBeGreaterThan(0);
    expectExactTextContent('Confidence: 86.0%');
    expect(
      screen.getByText(
        'This image was restored from detection history. Choose a new file to analyze another image.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Review this prediction')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument();
  });

  it('shows feedback-corrected confidence as the primary confidence', async () => {
    mockPredictionResponse({
      success: true,
      accepted: true,
      decision: 'accepted',
      prediction: 'Corn_(maize)___healthy',
      model_prediction: 'Corn_(maize)___Common_rust_',
      confidence: 0.7,
      feedback_adjusted: {
        applied: true,
        raw_prediction: 'Corn_(maize)___Common_rust_',
        raw_model_prediction: 'Corn_(maize)___Common_rust_',
        raw_confidence: 0.62,
        raw_decision: 'accepted',
        match_type: 'exact',
        corrected_label: 'Corn_(maize)___healthy',
        adjusted_prediction: 'Corn_(maize)___healthy',
        adjusted_confidence: 0.7,
        adjusted_decision: 'accepted',
        base_class_probability: 0.62,
        support_weight: 1,
        total_support_weight: 1,
        consensus: 1,
        is_correct: false,
        source_image_hash: 'hash-a',
        distance: 0,
        feedback_id: 'feedback-a',
        feedback_ids: ['feedback-a'],
      },
      all_probabilities: {
        'Corn_(maize)___Common_rust_': 0.62,
        'Corn_(maize)___healthy': 0.24,
        unknown_unclassified: 0.14,
      },
      guidance: {
        title: 'Healthy Leaf',
        description: 'No visible signs of major maize leaf disease.',
        treatment: 'No treatment is needed right now.',
        prevention: 'Maintain regular field scouting.',
      },
      filename: 'adjusted.png',
      prediction_id: 'sha256:hash-a',
      image_hash: 'hash-a',
    });

    renderDetector();
    await uploadImage(makeImageFile('adjusted.png'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));

    expect(await screen.findByText('Primary Detection')).toBeInTheDocument();
    expectExactTextContent('Confidence: 70.0%');
    expect(screen.queryByText('Raw model output')).not.toBeInTheDocument();
    expect(screen.getAllByText('Common Rust').length).toBeGreaterThan(0);
    expect(screen.queryByText('Raw model confidence: 62.0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/Decision:/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText((_, node) => node?.textContent === 'Confidence: 70.0%').length).toBeGreaterThanOrEqual(2));
  });

  it('submits feedback and saves feedback metadata with history', async () => {
    const predictionBody = {
      success: true,
      accepted: true,
      decision: 'accepted',
      prediction: 'Corn_(maize)___Common_rust_',
      model_prediction: 'Corn_(maize)___Common_rust_',
      confidence: 0.81,
      prediction_id: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      image_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      all_probabilities: {
        'Corn_(maize)___Common_rust_': 0.81,
        'Corn_(maize)___healthy': 0.12,
        unknown_unclassified: 0.07,
      },
      guidance: {
        title: 'Common Rust',
        description: 'Reddish-brown pustules caused by rust fungi.',
        treatment: 'If rust is increasing early, apply a labeled foliar fungicide.',
        prevention: 'Prioritize resistant hybrids first.',
      },
      filename: 'rust.png',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(predictionBody),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderDetector();
    await uploadImage(makeImageFile('rust.png'));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));

    await waitFor(() => expect(screen.getAllByText('rust.png').length).toBeGreaterThanOrEqual(2));
    await userEvent.click(screen.getByLabelText('No'));
    await userEvent.selectOptions(screen.getByLabelText('What should it be?'), 'unknown_unclassified');
    await userEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8000/feedback');
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer test-access-token',
    });
    const feedbackBody = (fetchMock.mock.calls[1][1] as RequestInit).body;
    expect(feedbackBody).toBeInstanceOf(FormData);
    const feedbackPayload = JSON.parse(String((feedbackBody as FormData).get('payload')));
    expect(feedbackPayload).toMatchObject({
      prediction_id: predictionBody.prediction_id,
      image_hash: predictionBody.image_hash,
      corrected_label: 'unknown_unclassified',
      is_correct: false,
      training_consent: false,
    });
    expect((feedbackBody as FormData).get('file')).toBeNull();
    expect(await screen.findByText('Feedback submitted and saved with this history item.')).toBeInTheDocument();

    await waitFor(async () => {
      const records = await getDetectionHistory();
      expect(records[0]).toMatchObject({
        prediction_id: predictionBody.prediction_id,
        image_hash: predictionBody.image_hash,
        prediction: 'Corn_(maize)___Common_rust_',
        model_prediction: 'Corn_(maize)___Common_rust_',
        decision: 'accepted',
        feedback: {
          wasPredictionCorrect: false,
          correctClass: 'unknown_unclassified',
          predictedClass: 'Corn_(maize)___Common_rust_',
          modelPrediction: 'Corn_(maize)___Common_rust_',
          decision: 'accepted',
          feedbackAdjusted: false,
        },
      });
    });
  });

  it('sends the image with feedback only when training consent is checked', async () => {
    const predictionBody = {
      success: true,
      accepted: true,
      decision: 'accepted',
      prediction: 'Corn_(maize)___healthy',
      model_prediction: 'Corn_(maize)___healthy',
      confidence: 0.91,
      prediction_id: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      image_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      all_probabilities: {
        'Corn_(maize)___healthy': 0.91,
        unknown_unclassified: 0.09,
      },
      guidance: {
        title: 'Healthy Leaf',
        description: 'No visible signs of major maize leaf disease.',
        treatment: 'No treatment is needed right now.',
        prevention: 'Maintain regular field scouting.',
      },
      filename: 'healthy.png',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(predictionBody),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const file = makeImageFile('healthy.png');
    renderDetector();
    await uploadImage(file);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));
    await waitFor(() => expect(screen.getAllByText('healthy.png').length).toBeGreaterThanOrEqual(2));

    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.click(screen.getByLabelText('Include this image for future model training'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const feedbackBody = (fetchMock.mock.calls[1][1] as RequestInit).body as FormData;
    const feedbackPayload = JSON.parse(String(feedbackBody.get('payload')));

    expect(feedbackPayload).toMatchObject({
      prediction_id: predictionBody.prediction_id,
      image_hash: predictionBody.image_hash,
      corrected_label: 'Corn_(maize)___healthy',
      is_correct: true,
      training_consent: true,
    });
    const submittedFile = feedbackBody.get('file');
    expect(submittedFile).toBeInstanceOf(File);
    expect((submittedFile as File).name).toBe('healthy.png');
    expect((submittedFile as File).type).toBe('image/png');
  });

  it('allows another upload after feedback is submitted and reset', async () => {
    const firstPrediction = {
      success: true,
      accepted: true,
      decision: 'accepted',
      prediction: 'Corn_(maize)___Common_rust_',
      model_prediction: 'Corn_(maize)___Common_rust_',
      confidence: 0.81,
      prediction_id: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      image_hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      all_probabilities: {
        'Corn_(maize)___Common_rust_': 0.81,
        'Corn_(maize)___healthy': 0.19,
      },
      guidance: {
        title: 'Common Rust',
        description: 'Reddish-brown pustules caused by rust fungi.',
        treatment: 'If rust is increasing early, apply a labeled foliar fungicide.',
        prevention: 'Prioritize resistant hybrids first.',
      },
      filename: 'camera.jpg',
    };
    const secondPrediction = {
      ...firstPrediction,
      prediction_id: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      image_hash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      prediction: 'Corn_(maize)___healthy',
      model_prediction: 'Corn_(maize)___healthy',
      confidence: 0.9,
      filename: 'camera.jpg',
      all_probabilities: {
        'Corn_(maize)___healthy': 0.9,
        'Corn_(maize)___Common_rust_': 0.1,
      },
      guidance: {
        title: 'Healthy Leaf',
        description: 'No visible signs of major maize leaf disease.',
        treatment: 'No treatment is needed right now.',
        prevention: 'Maintain regular field scouting.',
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(firstPrediction),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(secondPrediction),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderDetector();
    await uploadImage(new File(['first-image'], 'camera.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByLabelText('Yes'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Analyze Image' })).toBeDisabled();

    await uploadImage(new File(['second-image'], 'camera.jpg', { type: 'image/jpeg' }));
    expect(screen.getByRole('button', { name: 'Analyze Image' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Analyze Image' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findAllByText('Healthy Leaf')).not.toHaveLength(0);
  });
});
