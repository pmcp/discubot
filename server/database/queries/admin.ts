import type {
  Feedback,
  InsertFeedback,
  InsertSubscriber,
} from '@@/types/database'

export const createFeedback = async (payload: InsertFeedback) => {
  const feedback = await useDB()
    .insert(tables.feedback)
    .values(payload)
    .returning()
    .get()
  return feedback
}

export const getAllFeedback = async () => {
  const feedback = await useDB().query.feedback.findMany({
    with: {
      user: {
        columns: {
          hashedPassword: false,
        },
      },
    },
    orderBy: [desc(tables.feedback.createdAt)],
  })
  return feedback
}

export const updateFeedback = async (
  id: string,
  payload: Partial<Feedback>,
) => {
  const feedback = await useDB()
    .update(tables.feedback)
    .set(payload)
    .where(eq(tables.feedback.id, id))
    .returning()
    .get()
  return feedback
}

export const deleteFeedback = async (id: string) => {
  const feedback = await useDB()
    .delete(tables.feedback)
    .where(eq(tables.feedback.id, id))
  return feedback
}

export const getFeedbackById = async (id: string) => {
  const feedback = await useDB().query.feedback.findFirst({
    where: eq(tables.feedback.id, id),
    with: {
      user: true,
    },
  })
  return feedback
}

export const getFeedbackByUserId = async (userId: string) => {
  const feedback = await useDB().query.feedback.findMany({
    where: eq(tables.feedback.user, userId),
  })
  return feedback
}

export const insertSubscriber = async (payload: InsertSubscriber) => {
  const subscriber = await useDB()
    .insert(tables.subscribers)
    .values(payload)
    .returning()
    .get()
  return subscriber
}

export const getAllSubscribers = async () => {
  const subscribers = await useDB().query.subscribers.findMany()
  return subscribers
}
