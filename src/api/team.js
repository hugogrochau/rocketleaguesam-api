import { Router } from 'express'
import Team from '../models/team'
import Player from '../models/player'
// TODO update documentation examples

/**
 * @apiDefine PlayerNotFoundError
 *
 * @apiError PlayerNotFound Player could not be found
 *
 * @apiErrorExample PlayerNotFound Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "status": "error",
 *       "message": "Player not found",
 *       "code": "PlayerNotFound"
 *     }
 */

/**
 * @apiDefine TeamNotFoundError
 *
 * @apiError TeamNotFound Team could not be found
 *
 * @apiErrorExample TeamNotFound Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "status": "error",
 *       "message": "Team not found",
 *       "code": "TeamNotFound"
 *     }
 */

/**
 * @apiDefine InputError
 *
 * @apiError Input Input is invalid
 *
 * @apiErrorExample Input Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "status": "error",
 *       "message": "Input error",
 *       "code": "Input",
 *       "data": {
 *         "playerId": {
 *           "param": "playerId",
 *           "msg": "Invalid Steam 64 ID",
 *           "value": "banana"
 *         }
 *       }
 *     }
 */

/**
 * @apiDefine DatabaseError
 *
 * @apiError Database Error with the application database
 *
 *  @apiErrorExample Database Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "status": "error",
 *       "message": "Database error",
 *       "code": "Database",
 *       "data": "DATABASE ERROR DATA"
 *     }
 */

const api = Router()

/**
 * @api {get} /team/ Get all Teams
 * @apiName GetTeams
 * @apiGroup Team
 *
 * @apiSuccess {Object[]} data List of Teams
 *
 * @apiUse DatabaseError
 */
api.get('/', (req, res) => {
  new Team()
    .fetchAll({ withRelated: 'players' })
    .then((model) => res.jsend.success(model.toJSON()))
    .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
})

/**
 * @api {get} /team/:id Get team information
 * @apiName GetTeam
 * @apiGroup Team
 *
 * @apiParam {Number} id Team's unique id.
 *
 * @apiSuccess {Object} data Team data
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "data": {
 *         "id": "1",
 *         "attributes": {
 *           "name": "Black Dragons",
 *           "image_url": "http://d31qciy1ywu4xk.cloudfront.net/bd-logo-white-bg.png",
 *           "created_at": "2017-01-15T19:59:29.858Z",
 *           "last_update": "2017-01-15T19:59:29.858Z",
 *           "players": []
 *         }
 *       }
 *     }
 *
 * @apiUse InputError
 *
 * @apiUse TeamNotFoundError
 *
 * @apiUse DatabaseError
 */
api.get('/:id', (req, res) => {
  req.checkParams('id', 'Invalid Team id').isInt({ min: 1 })

  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      return res.status(400).jsend.error('Input error', 'Input', result.mapped())
    }

    new Team({
      id: req.params.id,
    })
      .fetch({ require: true, withRelated: 'players' })
      .then((model) => res.jsend.success(model.toJSON()))
      .catch(Team.NotFoundError, () => res.status(404).jsend.error('Team not found', 'TeamNotFound'))
      .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
  })
})

/**
 * @api {post} /team/add Add Team
 * @apiName AddTeam
 * @apiGroup Team
 *
 * @apiParam {String} name Team name
 *
 * @apiSuccess {Object} team Team object
 *
 * @apiUse InputError
 *
 * @apiUse DatabaseError
 */
api.post('/add', (req, res) => {
  req.checkBody('name', 'Invalid Team name').isLength({ min: 2, max: 30 })

  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      return res.status(400).jsend.error('Input error', 'Input', result.mapped())
    }

    new Team()
      .save({ name: req.body.name }, { method: 'insert' })
      .then((model) => res.jsend.success(model.toJSON()))
      .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
  })
})

/**
 * @api {get} /team/:id/add-player/:player-platform/:player-id Add Player to Team
 * @apiName AddPlayerToTeam
 * @apiGroup Team
 *
 * @apiParam {Number} id Team's unique id
 * @apiParam {String="0","1","2","steam","ps4","xbox"} playerPlatform Player's platform
 * @apiParam {String} playerId Player's unique id.
 *
 * @apiSuccess {Object} player Player object
 *
 * @apiUse InputError
 *
 * @apiUse PlayerNotFoundError
 *
 * @apiUse TeamNotFoundError
 *
 * @apiUse DatabaseError
 */
api.get('/:id/add-player/:playerPlatform/:playerId', (req, res) => {
  req.checkParams('id', 'Invalid Team id').isInt({ min: 1 })
  req.checkParams('playerPlatform', 'Invalid platform').isValidPlatform()
  req.checkParams('playerId', 'Invalid id').isValidIdForPlatform(req.params.playerPlatform)

  const platformId = Player.getPlatformIdFromString(req.params.playerPlatform)

  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      return res.status(400).jsend.error('Input error', 'Input', result.mapped())
    }

    /* check if team exists */
    new Team({ id: req.params.id })
      .fetch()
      .then(() => {
        new Player({ id: req.params.playerId, platform: platformId })
          .save({ team_id: req.params.id })
          .then((model) => {
            res.jsend.success(model.toJSON())
          })
          .catch(Player.NoRowsUpdatedError, () => res.status(404).jsend.error('Player not found', 'PlayerNotFound'))
          .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
      })
      .catch(Team.NotFoundError, (err) => res.status(404).jsend.error('Team not found', 'TeamNotFound', err))
  })
})

/**
 * @api {get} /team/:id/remove-player/:player-platform/:player-id Remove Player from Team
 * @apiName RemovePlayerFromTeam
 * @apiGroup Team
 *
 * @apiParam {Number} id Team's unique id
 * @apiParam {String="0","1","2","steam","ps4","xbox"} playerPlatform Player's platform
 * @apiParam {String} playerId Player's unique id.
 *
 * @apiSuccess {Object} player Player object
 *
 * @apiUse InputError
 *
 * @apiUse PlayerNotFoundError
 *
 * @apiUse TeamNotFoundError
 *
 * @apiUse DatabaseError
 */
api.get('/:id/remove-player/:playerPlatform/:playerId', (req, res) => {
  req.checkParams('id', 'Invalid Team id').isInt({ min: 1 })
  req.checkParams('playerPlatform', 'Invalid platform').isValidPlatform()
  req.checkParams('playerId', 'Invalid id').isValidIdForPlatform(req.params.playerPlatform)

  const platformId = Player.getPlatformIdFromString(req.params.playerPlatform)

  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      return res.status(400).jsend.error('Input error', 'Input', result.mapped())
    }

    new Player({ id: req.params.playerId, platform: platformId })
      .save({ team_id: null })
      .then((model) => {
        res.jsend.success(model.toJSON())
      })
      .catch(Player.NoRowsUpdatedError, () => res.status(404).jsend.error('Player not found', 'PlayerNotFound'))
      .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
  })
})

/**
 * @api {get} /team/:id/delete Delete team
 * @apiName DeleteTeam
 * @apiGroup Team
 *
 * @apiParam {Number} id Team's unique id.
 *
 * @apiSuccess {Object} success Success message
 *
 * @apiUse DatabaseError
 *
 * @apiUse InputError
 *
 * @apiUse TeamNotFoundError
 */
api.get('/:id/delete', (req, res) => {
  req.checkParams('id', 'Invalid Team id').isInt({ min: 1 })

  req.getValidationResult().then((result) => {
    if (!result.isEmpty()) {
      return res.status(400).jsend.error('Input error', 'Input', result.mapped())
    }

    new Team({
      id: req.params.id,
    })
      .fetch({ require: true, withRelated: 'players' })
      .then((team) => {
        team
        .players()
        .query()
        .where('team_id', team.get('id'))
        .update({ team_id: null })
        .then(() => {
          team.destroy({ require: true })
            .then(() => res.jsend.success('Team deleted'))
            .catch(Team.NoRowsDeletedError, (err) => res.status(500).jsend.error('Database error', 'Database', err))
        })
        .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
      })
      .catch(Team.NotFoundError, (err) => res.status(404).jsend.error('Team not found', 'TeamNotFound', err))
      .catch((err) => res.status(500).jsend.error('Database error', 'Database', err))
  })
})

export default api
