import { Router, Request, Response } from "express"
import { getUsageByUser, getUsageByUserAndDateRange } from "../db"

const router = Router()

router.get("/v1/usage", (req: Request, res: Response) => {
  const user = req.user!

  const startDate = req.query.start_date as string | undefined
  const endDate = req.query.end_date as string | undefined

  let usage
  if (startDate && endDate) {
    usage = getUsageByUserAndDateRange(user.id, startDate, endDate)
  } else {
    usage = getUsageByUser(user.id)
  }

  res.json({
    user_id: user.id,
    usage,
  })
})

export default router
