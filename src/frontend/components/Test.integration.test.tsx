import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Demo from './app';
import { saveDetectionHistoryItem } from './detectionHistory';
import { LanguageProvider } from './i18n';
import { Provider } from './ui/provider';

const renderDetector = () =>
  render(
    <Provider>
      <LanguageProvider>
        <Demo />
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
  });
});
