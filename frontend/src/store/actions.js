import wav from 'wallet-address-validator';
import {
  simplex
} from '@/config.js';
import {
  getQuote,
  exchangeRates
} from '@/simplex-api';

var quoteChanges = Object.freeze({
  fiat_amount: 1,
  digital_amount: 2,
  fiat_currency: 3,
  digital_currency: 4
});

let canQuote = (state) => !state.status.invalidFiatAmount || !state.status.invalidDigitalAmount;
let updateValues = (qChange, {
  state,
  dispatch,
  commit
}) => {
  return new Promise((resolve, reject) => {
    let onSuccess = (result) => {
      const resp = result.data;
      if (!resp.error) {
        commit('setDigitalAmount', resp.result.digital_money.amount);
        commit('setFiatAmount', resp.result.fiat_money.base_amount);
        commit('setFiatTotal', resp.result.fiat_money.total_amount);
        commit('setInvalidDigitalAmount', false);
        console.log(resp.result.fiat_money.total_amount < state.minFiat[state.fiatCurrency] || resp.result.fiat_money.total_amount > state.maxFiat[state.fiatCurrency]); // todo remove dev item
        console.log(resp.result.fiat_money.total_amount < state.minFiat[state.fiatCurrency]); // todo remove dev item
        console.log(resp.result.fiat_money.total_amount > state.maxFiat[state.fiatCurrency]); // todo remove dev item
        const isInvalidFiat = resp.result.fiat_money.total_amount < state.minFiat[state.fiatCurrency] || resp.result.fiat_money.total_amount > state.maxFiat[state.fiatCurrency];
        commit('setInvalidFiatAmount', isInvalidFiat);
        commit('setUserId', resp.result.user_id);
        resolve();
      } else {
        console.log(resp.result);
        reject(resp);
      }
    };
    let onError = (err) => {
      console.log(err);
      reject(err);
    };
    if (canQuote(state)) {
      switch (qChange) {
        case quoteChanges.fiat_amount:
        case quoteChanges.fiat_currency:
          commit('setRequestedCurrency', state.orderInfo.fiatCurrency);
          getQuote({
            digital_currency: state.orderInfo.digitalCurrency,
            fiat_currency: state.orderInfo.fiatCurrency,
            requested_currency: state.orderInfo.fiatCurrency,
            requested_amount: state.orderInfo.fiatAmount
          }).then(onSuccess).catch(onError);
          break;
        case quoteChanges.digital_amount:
        case quoteChanges.digital_currency:
          commit('setRequestedCurrency', state.orderInfo.digitalCurrency);
          getQuote({
            digital_currency: state.orderInfo.digitalCurrency,
            fiat_currency: state.orderInfo.fiatCurrency,
            requested_currency: state.orderInfo.digitalCurrency,
            requested_amount: state.orderInfo.digitalAmount
          }).then(onSuccess).catch(onError);
          break;
      }
    } else {
      reject(new Error('canQuote false'));
    }
  });
};

// ?to=0x9C483A851938d1C77a5e7e50eFDA4751A3637215&amount=2&fiat=eur
// ?to=0x9C483A851938d1C77a5e7e50eFDA4751A3637215&amount=2
// ?amount=2
export default {
  setCurrencyMaxAndMins ({dispatch, commit, state}) {
    exchangeRates()
      .then(rawResult => {
        console.log(rawResult); // todo remove dev item
        const result = rawResult.data.result.rates;
        const minFiat = {};
        const maxFiat = {};
        simplex.validFiat.forEach(item => {
          const details = result.find(entry => entry.rate_currency === item);
          minFiat[item] = details.rate * simplex.minFiat.USD;
          maxFiat[item] = details.rate * simplex.maxFiat.USD;
        })
        commit('setMinFiat', minFiat);
        commit('setMaxFiat', maxFiat);
      });
  },
  saveQueryVal ({dispatch, commit, state}, val) {
    if (val.amount && !val.fiat) {
      dispatch('setDigitalAmount', +val.amount);
    } else if (val.fiat && !val.amount) {
      const upperFiat = val.fiat.toUpperCase();
      if (simplex.validFiat.includes(upperFiat)) {
        dispatch('setFiatCurrency', val.fiat.toUpperCase());
      }
    } else if (val.amount && val.fiat) {
      dispatch('setDigitalAmount', +val.amount)
        .then(() => {
          const upperFiat = val.fiat.toUpperCase();
          if (simplex.validFiat.includes(upperFiat)) {
            dispatch('setFiatCurrency', val.fiat.toUpperCase())
              .then(() => {
                setTimeout(() => {
                  dispatch('setDigitalAmount', +val.amount);
                }, 500);
              });
          }
        });
    }
    if (val.to) {
      dispatch('setDigitalAddress', val.to);
    }

    commit('saveQueryValue', val);
  },
  setDigitalAddress ({
    commit,
    state
  }, address) {
    if (wav.validate(address, state.orderInfo.digitalCurrency)) {
      commit('setDigitalAddress', address);
      commit('setInvalidAddress', false);
    } else {
      commit('setInvalidAddress', true);
      commit('setDigitalAddress', '');
    }
  },
  setFiatAmount ({
    commit,
    state
  }, amount) {
    commit('setFiatAmount', amount);
    if (amount >= state.minFiat[state.fiatCurrency] && amount <= state.maxFiat[state.fiatCurrency]) {
      commit('setInvalidFiatAmount', false);
      return updateValues(quoteChanges.fiat_amount, {
        commit,
        state
      });
    } else {
      commit('setInvalidFiatAmount', true);
      return Promise.resolve();
    }
  },
  setDigitalAmount ({
    commit,
    state
  }, amount) {
    commit('setDigitalAmount', amount);
    if (amount > 0) {
      commit('setInvalidDigitalAmount', false);
      return updateValues(quoteChanges.digital_amount, {
        commit,
        state
      });
    } else {
      commit('setInvalidDigitalAmount', true);
      return Promise.resolve();
    }
  },
  setFiatCurrency ({
    commit,
    state
  }, currency) {
    commit('setFiatCurrency', currency);
    updateValues(quoteChanges.fiat_currency, {
      commit,
      state
    });
  },
  setDigitalCurrency ({
    commit,
    state
  }, currency) {
    commit('setDigitalCurrency', currency);
    updateValues(quoteChanges.digital_currency, {
      commit,
      state
    });
  }
};
