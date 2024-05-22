import { getDisplayedRows } from "./getLeaderboard"

describe("getDisplayedRows", () => {
  const sampleLeaderboard = [
    {
      id: "1",
      position: 1,
      name: "Alice",
      numVoted: 100,
      accuracy: 99,
      averageTimeTaken: 30,
      score: 500,
    },
    {
      id: "2",
      position: 2,
      name: "Bob",
      numVoted: 100,
      accuracy: 97,
      averageTimeTaken: 28,
      score: 490,
    },
    {
      id: "3",
      position: 3,
      name: "Charlie",
      numVoted: 100,
      accuracy: 95,
      averageTimeTaken: 25,
      score: 480,
    },
    {
      id: "4",
      position: 4,
      name: "David",
      numVoted: 100,
      accuracy: 93,
      averageTimeTaken: 30,
      score: 470,
    },
    {
      id: "5",
      position: 5,
      name: "Eve",
      numVoted: 100,
      accuracy: 90,
      averageTimeTaken: 35,
      score: 460,
    },
    {
      id: "6",
      position: 6,
      name: "Faythe",
      numVoted: 100,
      accuracy: 89,
      averageTimeTaken: 20,
      score: 450,
    },
    {
      id: "7",
      position: 7,
      name: "Grace",
      numVoted: 100,
      accuracy: 88,
      averageTimeTaken: 22,
      score: 440,
    },
    {
      id: "8",
      position: 8,
      name: "Heidi",
      numVoted: 100,
      accuracy: 87,
      averageTimeTaken: 23,
      score: 430,
    },
    {
      id: "9",
      position: 9,
      name: "Ivan",
      numVoted: 100,
      accuracy: 85,
      averageTimeTaken: 25,
      score: 420,
    },
    {
      id: "10",
      position: 10,
      name: "Judy",
      numVoted: 100,
      accuracy: 84,
      averageTimeTaken: 26,
      score: 410,
    },
    {
      id: "11",
      position: 11,
      name: "Michael",
      numVoted: 100,
      accuracy: 82,
      averageTimeTaken: 24,
      score: 400,
    },
  ]

  test("Should return top 5 and checker plus/minus 2 when checker is in the middle", () => {
    const result = getDisplayedRows("6", sampleLeaderboard)
    expect(result).toEqual([
      ...sampleLeaderboard.slice(0, 5),
      ...sampleLeaderboard.slice(5, 8), // Faythe is at position 6, range 4-8
    ])
  })

  test("Should handle checker in the 4th position", () => {
    const result = getDisplayedRows("4", sampleLeaderboard)
    expect(result).toEqual([
      ...sampleLeaderboard.slice(0, 5),
      ...sampleLeaderboard.slice(5, 6), // Faythe is at position 6, range 4-8
    ])
  })

  test("Should handle checker being in the top 5", () => {
    const result = getDisplayedRows("3", sampleLeaderboard)
    expect(result).toEqual(sampleLeaderboard.slice(0, 5))
  })

  test("Should handle checker being in the top 1", () => {
    const result = getDisplayedRows("1", sampleLeaderboard)
    expect(result).toEqual(sampleLeaderboard.slice(0, 5))
  })

  test("Should handle checker at the end of the array", () => {
    const result = getDisplayedRows("11", sampleLeaderboard)
    expect(result).toEqual([
      ...sampleLeaderboard.slice(0, 5),
      ...sampleLeaderboard.slice(8, 11),
    ])
  })

  test("Should throw an error if checker is not found", () => {
    expect(() => getDisplayedRows("12", sampleLeaderboard)).toThrow(
      "Checker not found in leaderboard"
    )
  })

  test("Should handle small leaderboards correctly", () => {
    const smallBoard = sampleLeaderboard.slice(0, 3) // Only 3 members
    const result = getDisplayedRows("2", smallBoard)
    expect(result).toEqual(smallBoard)
  })
})
