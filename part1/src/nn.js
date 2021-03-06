import 'babel-polyfill';
import * as tf from '@tensorflow/tfjs';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './game/constants';
import { Runner } from './game';

let runner = null;
// initial setup for the game the  setup function is called when the dom gets loaded

function setup() {
  // Initialize the game Runner.
  runner = new Runner('.game', {
    DINO_COUNT: 1,
    onReset: handleReset,
    onCrash: handleCrash,
    onRunning: handleRunning,
    onKey: handleKey
  });
  // Set runner as a global variable if you need runtime debugging.
  window.runner = runner;
  // Initialize everything in the game and start the game.
  runner.init();
}
// variable which tells whether thethe game is being loaded for the first time i.e. not a reset

let firstTime = true;


function handleReset(dinos) {
  // running this for single dino at a time
  // console.log(dinos);

  const dino = dinos[0];
  // if the game is being started for the first time initiate
  // the model and compile it to make it ready for training and predicting
  if (firstTime) {
    firstTime = false;
    // creating a tensorflow sequential model
    dino.model = tf.sequential();
    // dino.model.init();
    // adding the first hidden layer to the model using with 4 inputs ,
    // sigmoid activation function
    // and output of 6
    dino.model.add(tf.layers.dense({
      inputShape:[4],
      activation:'sigmoid',
      units:6
    }))

    /* this is the second output layer with 6 inputs coming from the previous hidden layer
    activation is again sigmoid and output is given as 2 units 10 for not jump and 01 for jump
    */
    dino.model.add(tf.layers.dense({
      inputShape:[6],
      activation:'sigmoid',
      units:3
    }))

    /* compiling the model using meanSquaredError loss function and adam
    optimizer with a learning rate of 0.1 */
    dino.model.compile({
      loss:'meanSquaredError',
      optimizer : tf.train.adam(0.1)
    })

    // object which will containn training data and appropriate labels
    dino.training = {
      inputs: [],
      labels: []
    };

  } else {
    // Train the model before restarting.
    // log into console that model will now be trained
    console.info('Training');
    // convert the inputs and labels to tensor2d format and  then training the model
    console.info(tf.tensor2d(dino.training.inputs))
    dino.model.fit(tf.tensor2d(dino.training.inputs), tf.tensor2d(dino.training.labels));
  }
}

/**
 * documentation
 * @param {object} dino
 * @param {object} state
 * returns a promise resolved with an action
 */

function handleRunning( dino, state ) {
  return new Promise((resolve) => {
      // whenever the dino is not jumping decide whether it needs to jump or not
    let action = 0;// variable for action 1 for jump -1 for duck
    // call model.predict on the state vector after converting it to tensor2d object
    let runPredict = (!dino.jumping && !dino.ducking);
    let jumpPredict = (dino.jumping && Math.random() > .9);
    let duckPredict = (dino.ducking && Math.random() > .9);
    if (runPredict || jumpPredict || duckPredict) {

      const prediction = dino.model.predict(tf.tensor2d([convertStateToVector(state)]));

      // the predict function returns a tensor we get the data in a promise as result
      // and basedd on result decide the action
      const predictionPromise = prediction.data();

      predictionPromise.then((result) => {
        dino.lastPrediction = result;
        dino.lastState = state;

        //console.log(result);
        const mightAsWellJump = result[0] > result[1] && result[0] > result[2];
        const duckDuckGo = result[1] > result[0] && result[1] > result[2]
        if (mightAsWellJump) {
          // jump
          action = 1;
          dino.lastJumpingState = state;
        }

        if (duckDuckGo) {
          action = -1;
          dino.lastDuckingState = state;
        }

        if (!mightAsWellJump && !duckDuckGo) {
          dino.lastRunningState = state;
        }

        resolve(action);
      });
    }
    else {
      resolve(action);
    }
  });
}
/**
 *
 * @param {object} dino
 * handles the crash of a dino before restarting the game
 *
 */
function handleCrash( dino, state ) {
  let input = null;
  let label = [1, .8, 0];

  if (dino.jumping) {
    label[0] = 0;
    label[1] = .25;
    label[2] = 1;
    input = convertStateToVector(dino.lastJumpingState);

    //fast fall?
    dino.training.inputs.push(convertStateToVector(dino.lastState));
    dino.training.labels.push([0, .5, .3]);
  }

  if (dino.ducking) {
    label[0] = .5;
    label[1] = 0;
    label[2] = 1;
    input = convertStateToVector(dino.lastDuckingState);
  }

  if (!dino.ducking && !dino.jumping) {
    input = convertStateToVector(dino.lastRunningState);
  }

  // push the new input to the training set
  dino.training.inputs.push(input);
  // push the label to labels
  dino.training.labels.push(label);
}

function handleKey(action, obstacle, dino) {
  if(obstacle === undefined)
    return;

  let label = [0, 0, 0];
  if (action === 1)
    label[0] = 1;
  else if (action === -1)
    label[1] = 1;
  else
    label[2] = 1;
  console.log(label);

  const state = {
    obstacleX: obstacle.xPos,
    obstacleY: obstacle.yPos,
    obstacleWidth: obstacle.width,
    speed: runner.currentSpeed
  };

  dino.training.labels.push(label);
  dino.training.inputs.push(convertStateToVector(state));
}


/**
 *
 * @param {object} state
 * returns an array
 * converts state to a feature scaled array
 */
function convertStateToVector(state) {
  if (state) {
    return [
      state.obstacleX / CANVAS_WIDTH,
      state.obstacleY / CANVAS_HEIGHT,
      state.obstacleWidth / CANVAS_WIDTH,
      state.speed / 100,
    ];
  }
  return [0, 0, 0, 0];
}
// call setup on loading content
document.addEventListener('DOMContentLoaded', setup);
