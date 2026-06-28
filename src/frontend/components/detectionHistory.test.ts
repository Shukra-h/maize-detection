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

  it('round-trips feedback-corrected prediction metadata', async () => {
    await saveDetectionHistoryItem(makeRecord('adjusted', '2026-05-18T10:00:00.000Z', {
      feedback_adjusted: {
        applied: true,
        raw_prediction: 'Corn_(maize)___Common_rust_',
        raw_model_prediction: 'Corn_(maize)___Common_rust_',
        raw_confidence: 0.62,
        match_type: 'exact',
        corrected_label: 'Corn_(maize)___healthy',
        adjusted_prediction: 'Corn_(maize)___healthy',
        adjusted_confidence: 0.7,
        adjusted_decision: 'accepted',
        base_class_probability: 0.62,
        support_weight: 1,
        total_support_weight: 1,
        consensus: 1,
        feedback_ids: ['feedback-a'],
      },
    }));

    const records = await getDetectionHistory();

    expect(records[0].feedback_adjusted).toMatchObject({
      applied: true,
      adjusted_prediction: 'Corn_(maize)___healthy',
      adjusted_confidence: 0.7,
      base_class_probability: 0.62,
      support_weight: 1,
      consensus: 1,
    });
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
