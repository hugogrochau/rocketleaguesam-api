import openid from 'openid'
import jwt from 'jwt-simple'
import RocketLeagueApisClient, { TRACKER } from 'rocket-league-apis-client'
import Player from '../models/player'

const authenticate = (returnUrl, realm) => {
  const relyingParty = new openid.RelyingParty(returnUrl, realm, true, false, [])
  // Resolve identifier, associate, and build authentication URL
  return new Promise((resolve, reject) =>
    relyingParty.authenticate('https://steamcommunity.com/openid', false, (error, authUrl) => {
      if (error) {
        reject({ message: 'Unauthorized', data: error.message })
      } else if (!authUrl) {
        reject('Unauthorized')
      } else {
        resolve(authUrl)
      }
    })
  )
}

const verify = (returnUrl, realm, responseUrl) => {
  const relyingParty = new openid.RelyingParty(returnUrl, realm, true, false, [])
  const secret = process.env.JWT_SECRET
  const rankApi = RocketLeagueApisClient({
    tracker: TRACKER.ROCKETLEAGUE_TRACKER_NETWORK,
    apiUrl: process.env.ROCKETLEAGUE_TRACKER_NETWORK_API_URL,
    apiKey: process.env.ROCKETLEAGUE_TRACKER_NETWORK_API_KEY,
  })

  return new Promise((resolve, reject) =>
    relyingParty.verifyAssertion(responseUrl, (error, result) => {
      if (error || !result.authenticated) {
        reject('Unauthorized')
      } else {
          // extract steamId
        const playerId = result.claimedIdentifier.slice(-17)
        const token = jwt.encode({ sub: playerId, iat: new Date().getTime() }, secret)

        new Player({
          id: playerId,
          platform: 0,
        }).fetch({ require: true })
          // player already exists
          .then(() => {
            resolve({ token })
          })
          // new player
          .catch(Player.NotFoundError, () => {
            rankApi(0, playerId)
              .then((playerData) =>
                new Player({
                  id: playerId,
                  platform: 0,
                }).save(playerData.player, { method: 'insert' })
              )
              .then((player) => resolve({ player: player.toJSON(), token }))
          })
          .catch((err) => reject({ message: 'DatabaseError', data: err }))
      }
    })
  )
}

export default { authenticate, verify }
