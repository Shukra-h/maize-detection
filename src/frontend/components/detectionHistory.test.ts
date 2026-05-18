import { describe, expect, it } from 'vitest';

import {
  deleteDetectionHistoryItem,
  getDetectionHistory,
  pruneDetectionHistory,
  saveDetectionHistoryItem,
  type DetectionHistoryRecord,
} from './detectionHistory';

const makeRecord = (
  id: string,
  createdAt: string,
  overrides: Partial<DetectionHistoryRecord> = {},
): DetectionHistoryRecord => ({
  id,
  createdAt,
  filename: `${id}.png`,
  imageBlob: new Blob([id], { type: 'image/png' }),
  prediction: 'Corn_(maize)___healthy',
  model_prediction: 'Corn_(maize)___healthy',
  decision: 'accepted',
  confidence: 0.91,
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
  ...overrides,
});

describe('detection history storage', () => {
  it('starts empty when no detections have been saved', async () => {
    await expect(getDetectionHistory()).resolves.toEqual([]);
  });

  it('saves records and returns newest first', async () => {
    const older = makeRecord('older', '2026-05-18T08:00:00.000Z');
    const newer = makeRecord('newer', '2026-05-18T09:00:00.000Z', {
      prediction: 'Corn_(maize)___Common_rust_',
      confidence: 0.86,
    });

    await saveDetectionHistoryItem(older);
    await saveDetectionHistoryItem(newer);

    const records = await getDetectionHistory();

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.id)).toEqual(['newer', 'older']);
    expect(records[0]).toMatchObject({
      id: 'newer',
      prediction: 'Corn_(maize)___Common_rust_',
      confidence: 0.86,
    });
  });

  it('deletes a saved record by id', async () => {
    await saveDetectionHistoryItem(makeRecord('keep', '2026-05-18T09:00:00.000Z'));
    await saveDetectionHistoryItem(makeRecord('delete', '2026-05-18T10:00:00.000Z'));

    await deleteDetectionHistoryItem('delete');

    const records = await getDetectionHistory();
    expect(records.map((record) => record.id)).toEqual(['keep']);
  });

  it('prunes older records beyond the requested limit', async () => {
    await saveDetectionHistoryItem(makeRecord('oldest', '2026-05-18T07:00:00.000Z'));
    await saveDetectionHistoryItem(makeRecord('middle', '2026-05-18T08:00:00.000Z'));
    await saveDetectionHistoryItem(makeRecord('newest', '2026-05-18T09:00:00.000Z'));

    await pruneDetectionHistory(2);

    const records = await getDetectionHistory();
    expect(records.map((record) => record.id)).toEqual(['newest', 'middle']);
  });
});
