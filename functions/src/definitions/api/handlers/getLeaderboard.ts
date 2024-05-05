import { Request, Response } from "express"
import { getFullLeaderboard } from "../../common/statistics"
import { LeaderboardEntry } from "../interfaces"
import { logger } from "firebase-functions/v2"
import * as admin from "firebase-admin"
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const getLeaderboardHandler = async (req: Request, res: Response) => {
  let displayedRows
  try {
    const checkerId = req.params.checkerId
    if (!checkerId) {
      return res.status(400).send("Checker ID missing.")
    }
    const leaderboardData = await getFullLeaderboard()
    try {
      displayedRows = getDisplayedRows(checkerId, leaderboardData)
    } catch (error) {
      logger.error(
        `Error fetching leaderboard, likely due to checker not found in leaderboard data: ${error}`
      )
      return res
        .status(500)
        .send(
          "Error fetching leaderboard, likely due to checker not found in leaderboard data"
        )
    }
    res.status(200).json(displayedRows)
  } catch (error) {
    logger.error(`Error fetching leaderboard: ${error}`)
    return res.status(500).send("Error fetching leaderboard")
  }
}

function getDisplayedRows(checkerId: string, leaderboard: LeaderboardEntry[]) {
  //find position of current checker in leaderboard data
  const checkerPosition = leaderboard.findIndex(
    (checker) => checker.id === checkerId
  )
  if (checkerPosition === -1) {
    throw new Error("Checker not found in leaderboard")
  }
  //return top 5 positions and those +/- 2 positions from current checker. altogether at most 10 entries should be returned
  // Always include the top 5 entries
  const topFive = leaderboard.slice(0, 5)
  // Calculate the range around the checker's position to exclude top 5 if there's an overlap
  let lowerBound = Math.max(5, checkerPosition - 2) // Start after top 5 or 2 positions before the checker
  let upperBound = Math.min(leaderboard.length, checkerPosition + 3) // Include checker's position + 2 more
  // Extract the vicinity without overlapping the top 5
  const vicinity = leaderboard.slice(lowerBound, upperBound)
  // Merge the two segments ensuring no duplicates based on id
  const uniqueIds = new Set(topFive.map((row) => row.id))
  return topFive.concat(vicinity.filter((row) => !uniqueIds.has(row.id)))
}

export default getLeaderboardHandler

export { getDisplayedRows }
