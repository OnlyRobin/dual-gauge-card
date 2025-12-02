// Visit https://github.com/MrLehner/stacked-dual-gauge-card for source, license and more information
// Copyright (c) 2019 Custom cards for Home Assistant
// Copyright (c) 2025 MrLehner

class StackedDualGaugeCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;

    if (!this.card) {
      this._createCard();
    }

    this._update();
  }

  setConfig(config) {
    this.config = JSON.parse(JSON.stringify(config));

    console.info(this.config);

    if (this.config.outer === undefined || this.config.outer == null || this.config.outer.length == 0 || this.config.outer[0].entity == undefined) {
      throw new Error('You need to define at least one entity for outer gauge');
    }
    if (this.config.inner === undefined || this.config.inner == null || this.config.inner.length == 0 || this.config.inner[0].entity == undefined) {
      throw new Error('You need to define at least one entity for inner gauge');
    }

    // Set default values, if not configured
    if (this.config.cardwidth === undefined || this.config.cardwidth == null || isNaN(this.config.cardwidth)) {
      this.config.cardwidth = 300;
      console.info("Setting default card width to " + this.config.cardwidth);
    }
    if (this.config.background_color === undefined || this.config.background_color == null) {
      this.config.background_color = "var(--secondary-background-color)";
      console.info("Setting default background color to " + this.config.background_color);
    }
    if (this.config.min === undefined || this.config.min == null || isNaN(this.config.min)) {
      this.config.min = 0;
      console.info("Setting default min value to " + this.config.min);
    }
    if (this.config.max === undefined || this.config.max == null || isNaN(this.config.max)) {
      this.config.max = 100;
      console.info("Setting default max value to " + this.config.max);
    }
    if (this.config.precision === undefined || this.config.precision == null || isNaN(this.config.precision)) {
      this.config.precision = 1;
      console.info("Setting default precision value to " + this.config.precision);
    }
    if (this.config.scale_factor === undefined || this.config.scale_factor == null || isNaN(this.config.scale_factor)) {
      this.config.scale_factor = 1.0;
      console.info("Setting default scale factor value to " + this.config.scale_factor);
    }
    if (this.config.title === undefined || this.config.title == null) {
      this.config.title = "";
      console.info("No tile defined.");
    }
    if (this.config.title_font_size === undefined || this.config.title_font_size == null) {
      this.config.title_font_size = "20px";
      console.info("Setting default title font size to " + this.config.title_font_size);
    }
    if (this.config.value_font_size === undefined || this.config.value_font_size == null) {
      this.config.value_font_size = "18px";
      console.info("Setting default value font size to " + this.config.value_font_size);
    }
    if (this.config.label_font_size === undefined || this.config.label_font_size == null) {
      this.config.label_font_size = "12px";
      console.info("Setting default label font size to " + this.config.label_font_size);
    }

    // Set default values for outer and inner gauges
    this._setDefaults(this.config.outer,0);
    this._setDefaults(this.config.inner, this.config.outer.length);
  }


  _setDefaults(gauge, color_offset=0) {
    // Default colors (for color values see https://github.com/home-assistant/frontend/blob/master/src/resources/theme/color.globals.ts)
    const color_list = ["green-color", "yellow-color", "orange-color", "red-color", "blue-color", "light-blue-color", "pink-color", "purple-color"];
    for (let i = 0; i < gauge.length; i++) {
      if (gauge[i].color === undefined || gauge[i].color == null) {
        gauge[i].color = `var(--${color_list[(i + color_offset)% color_list.length]})`;
        console.info("Setting default color for value #" + i + " to " + gauge[i].color + ".");
      }
      if (gauge[i].label === undefined || gauge[i].label == null) {
        gauge[i].label = "";
        console.info("No label for value #" + i + " defined.");
      }
    }
  }

  _update() {
    let faulty_entities = [];
    for (const element of this.config.outer) {
      if (this._hass.states[element.entity] == undefined) {
        console.error(`Undefined entity ${element.entity} for outer gauge`);
        faulty_entities.push(element.entity);
      }
    }
    for (const element of this.config.inner) {
      if (this._hass.states[element.entity] == undefined) {
        console.error(`Undefined entity ${element.entity} for inner gauge`);
        faulty_entities.push(element.entity);
      }
    }

    if (faulty_entities.length > 0) {
      if (this.card) {
        this.card.remove();
      }

      this.card = document.createElement('ha-card');
      if (this.config.header) {
        this.card.header = this.config.header;
      }

      const content = document.createElement('p');
      content.style.background = "red";
      content.style.padding = "8px";
      content.innerHTML = "Error finding these entities:<br>- " + faulty_entities.join("<br>- ");
      this.card.appendChild(content);
      this.appendChild(this.card);
      return;
    } else if (this.card && this.card.firstElementChild.tagName.toLowerCase() == "p") {
      this._createCard();
    }
    this._updateGauge('inner');
    this._updateGauge('outer');
  }

  _updateGauge(gauge_name) {
    const gauge_config = this.config[gauge_name];
    let low_value = this.config.min;
    for (let i = 0; i < gauge_config.length; i++) {
      const element = gauge_config[i];
      const value = this._getEntityStateValue(this._hass.states[element.entity], element.attribute);
      let gauge_value = low_value;
      if (!isNaN(value)) {
        gauge_value = Number(value) + low_value;
      }
      low_value = gauge_value;
      this._setCssVariable(this.nodes.content, `${gauge_name}-angle-${i}`, this._calculateRotation(gauge_value));
      this.nodes[gauge_name][i].value.innerHTML = this._formatValue(value);
    }
  }

  _showDetails(entity) {
    const event = new Event('hass-more-info', {
      bubbles: true,
      cancelable: false,
      composed: true
    });
    event.detail = {
      entityId: entity
    };
    console.log("Show more info for entity " + entity);
    this.card.dispatchEvent(event);
    return event;
  }

  _formatValue(value) {
    value = parseFloat(value) * this.config.scale_factor;
    value = value.toFixed(this.config.precision);
    return value;
  }

  _getEntityStateValue(entity, attribute) {
    if (!attribute) {
      if (isNaN(entity.state))
        return "-";
      else
        return entity.state;
    }

    if (isNaN(entity.attributes[attribute]))
      return "-";
    else
      return entity.attributes[attribute];
  }

  _calculateRotation(value) {
    if(isNaN(value)) return '180deg';
    const max_turn_value = Math.min(Math.max(value, this.config.min), this.config.max);
    return (180 + (5 * (max_turn_value - this.config.min)) / (this.config.max - this.config.min) / 10 * 360) + 'deg';
  }

  _createCard() {
    if (this.card) {
      this.card.remove();
    }

    this.card = document.createElement('ha-card');
    if (this.config.header) {
      this.card.header = this.config.header;
    }

    const content = document.createElement('div');
    this.card.appendChild(content);
    this.styles = document.createElement('style');
    this.card.appendChild(this.styles);
    this.appendChild(this.card);

    content.classList.add('stacked-dual-gauge-card');
    // Construct the inner HTML string
    let innerHTML_string = `
      <div class="stacked-dual-gauge">
        <div class="gauge-frame">
          <div class="gauge-background circle-container">
            <div class="circle"></div>
          </div>
          `;
    // Since the order of the elements are important for the visualization, we create the gauges in reverse order
    // Since the order of the elements are important for the click event, we create the gauges first then the labels
    for (let i = this.config.outer.length-1; i >= 0; i--) {
      innerHTML_string += `
          <div class="outer-gauge-${i} circle-container">
            <div class="circle"></div>
          </div>
          `;
    }
    for (let i = this.config.inner.length-1; i >= 0; i--) {
      innerHTML_string += `
          <div class="inner-gauge-${i} circle-container small-circle">
            <div class="circle"></div>
          </div>
          `;
    }
    for (let i = this.config.outer.length-1; i >= 0; i--) {
      innerHTML_string += `
          <div class="label-on-circle outer-label-container-${i}">
            <div class="gauge-value outer-value-${i}"></div>
            <div class="gauge-label outer-label-${i}">${this.config.outer[i].label}</div>
          </div>
          `;
    }
    for (let i = this.config.inner.length-1; i >= 0; i--) {
      innerHTML_string += `
          <div class="label-on-circle inner-label-container-${i}">
            <div class="gauge-value inner-value-${i}"></div>
            <div class="gauge-label inner-label-${i}">${this.config.inner[i].label}</div>
          </div>
          `;
    }
    innerHTML_string += `
        <div class="gauge-title">${this.config.title}</div>

        </div>
      </div>
      `;
    content.innerHTML = innerHTML_string

    this.nodes = {
      content: content,
      outer: [],
      inner: [],
    }

    for (let i = 0; i < this.config.outer.length; i++) {
      this.nodes.outer[i] = {
        value: content.querySelector('.outer-value-' + i),
        label_container: content.querySelector('.outer-label-container-' + i),
      };
      this.nodes.outer[i].label_container.addEventListener('click', event => {
        this._showDetails(this.config.outer[i].entity);
      });
    }

    for (let i = 0; i < this.config.inner.length; i++) {
      this.nodes.inner[i] = {
        value: content.querySelector('.inner-value-' + i),
        label_container: content.querySelector('.inner-label-container-' + i),
      };
      this.nodes.inner[i].label_container.addEventListener('click', event => {
        this._showDetails(this.config.inner[i].entity);
      });
    }

    this._initStyles();
  }

  _setCssVariable(node, variable, value) {
    node.style.setProperty('--' + variable, value);
  }

  _initStyles() {
    this.styles.innerHTML = `
      .stacked-dual-gauge-card {
        --gauge-card-width:${this.config.cardwidth}px;
        --gauge-background-color: ${this.config.background_color};

        --gauge-width: calc(var(--gauge-card-width) / 10.5);
        --label-radius: calc(var(--gauge-card-width) / 5.5);
        --title-font-size: ${this.config.title_font_size};
        --value-font-size: ${this.config.value_font_size};
        --label-font-size: ${this.config.label_font_size};

        width: var(--gauge-card-width);
        padding: 16px;
        box-sizing:border-box;
        margin: 6px auto;
      }

      .stacked-dual-gauge-card div {
        box-sizing:border-box
      }

      .stacked-dual-gauge {
        overflow: hidden;
        width: 100%;
        height: 0;
        padding-bottom: 50%;
      }

      .gauge-frame {
        width: 100%;
        height: 0;
        padding-bottom:100%;
        position: relative;
      }

      .circle {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 200%;
        border-radius: 100%;
        border: var(--gauge-width) solid;
        transition: border-color .5s linear;
      }

      .circle-container {
        position: absolute;
        transform-origin: 50% 100%;
        top: 0;
        left: 0;
        height: 50%;
        width: 100%;
        overflow: hidden;
        transition: transform .5s linear;
      }

      .small-circle .circle {
        top: 20%;
        left: 10%;
        width: 80%;
        height: 160%;
      }

      .gauge-background .circle {
        border: calc(var(--gauge-width) * 2 - 2px) solid var(--gauge-background-color);
      }

      .gauge-title {
        position: absolute;
        left: 50%;
        bottom: 50%;
        margin-bottom: 0.1em;
        transform: translateX(-50%);
        font-size: var(--title-font-size);
      }

      .label-on-circle {
        position: absolute;
        left: 50%;
        bottom: 50%;
        text-align: center;
        transform:
          translate(-50%, 50%)
          translate(calc(-1*var(--label-radius)*cos(var(--angle))), calc(-1*var(--label-radius)*sin(var(--angle))));
      }

      .gauge-value, .gauge-label {
        line-height: 85%;
        color: var(--label-color);
      }

      .gauge-value {
        font-size: var(--value-font-size);
        font-weight: bold;
      }

      .gauge-label {
        font-size: var(--label-font-size);
      }

    `;

    const segment_size = 170; // Below 180° to leave a little space at first and last label
    const rotationIncrement_for_labels = segment_size / (this.config.outer.length + this.config.inner.length);
    let rotational_position = (180-segment_size + rotationIncrement_for_labels) / 2;

    for (let i = 0; i < this.config.outer.length; i++) {
      this.styles.innerHTML += `
        .outer-gauge-${i} {
          transform: rotate(var(--outer-angle-${i}));
        }
        .outer-gauge-${i} .circle {
          border-color: ${this.config.outer[i].color};
        }
        .outer-label-container-${i} {
          --angle: ${rotational_position}deg;
          --label-color: ${this.config.outer[i].color};
        }
      `;
      rotational_position += rotationIncrement_for_labels;
    }

    for (let i = 0; i < this.config.inner.length; i++) {
      this.styles.innerHTML += `
        .inner-gauge-${i} {
          transform: rotate(var(--inner-angle-${i}));
        }
        .inner-gauge-${i} .circle {
          border-color: ${this.config.inner[i].color};
        }
        .inner-label-container-${i} {
          --angle: ${rotational_position}deg;
          --label-color: ${this.config.inner[i].color};
        }
      `;
      rotational_position += rotationIncrement_for_labels;
    }
  }
}

customElements.define('stacked-dual-gauge-card', StackedDualGaugeCard);
