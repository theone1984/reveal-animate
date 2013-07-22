/* Written by Thomas Endres (Thomas-Endres@gmx.de) in 2013.
 Dual licensed under the MIT license (http://dev.jquery.com/browser/trunk/jquery/MIT-LICENSE.txt).
 Please attribute the author if you use it. */

(function($) {
    Reveal.Animate = function() {

        var ANIMATION_ELEMENT_NAME = 'animation';
        var ANIMATE_ELEMENT_NAME = 'animate';

        var ANIMATION_ID_ATTRIBUTE = 'data-animation-id';

        var CURRENT_ANIMATION_NUMBER_ATTRIBUTE = 'data-current-animation';

        var DEFAULT_DURATION = 1000;

        var animationProviders = {};

        var forwardAnimationsPerElement = {};

        var backwardAnimationsPerElement = {};

        var currentAnimationNumber = 1;

        function initialize() {
            $('body').keydown(keyDownListener);
        }

        function addAnimationProvider(className, animationProvider) {
            animationProvider.initialize();
            animationProviders[className] = animationProvider;
        }

        function getCurrentSlide() {
            return $(Reveal.getCurrentSlide());
        }

        function isAnimatedSlide() {
            return getCurrentAnimationProvider() != null;
        }

        function getCurrentAnimationProvider() {
            for (var className in animationProviders) {
                var animationProvider = animationProviders[className];

                if ($(getCurrentSlide()).has(className).length == 1) {
                    return animationProvider;
                }
            }

            return null;
        }

        function getCurrentAnimationProviderClassName() {
            for (var className in animationProviders) {
                if ($(getCurrentSlide()).has(className).length == 1) {
                    return className;
                }
            }
            return null;
        }

        function getCurrentAnimationElement() {
            var animationElement = $(getCurrentAnimationProviderClassName(), Reveal.getCurrentSlide());

            if (!animationElement.attr(ANIMATION_ID_ATTRIBUTE)) {
                animationElement.attr(ANIMATION_ID_ATTRIBUTE, currentAnimationNumber++);
            }

            return animationElement;
        }

        function getCurrentAnimationNumber() {
            var currentAnimationNumber = getCurrentAnimationElement().attr(CURRENT_ANIMATION_NUMBER_ATTRIBUTE);
            return !currentAnimationNumber ? 0 : parseInt(currentAnimationNumber);
        }

        function saveNewAnimationNumber(direction) {
            getCurrentAnimationElement().attr(CURRENT_ANIMATION_NUMBER_ATTRIBUTE, getCurrentAnimationNumber() + direction);
        }

        function keyDownListener(event) {
            var direction = getDirection(event);

            if (direction == 0 || !isAnimatedSlide()) {
                return;
            }

            if (tryAnimate(getCurrentAnimationNumber(), direction)) {
                saveNewAnimationNumber(direction);
                event.stopPropagation();
            }
        }

        function getDirection(event) {
            if ([80, 33, 75, 38].indexOf(event.which) > -1) {
                // p, page up, arrow up
                return -1;
            } else if ([32, 78, 34, 74, 40].indexOf(event.which) > -1) {
                // space, n, page down, arrow down
                return +1;
            }
            return 0;
        }

        function getInitialValues(animationElement, animations) {
            var initialAnimationStepValues, animationSteps, i, elementId, property;

            initialAnimationStepValues = {};
            for (i = 0; i < animations.length; i++) {
                animationSteps = animations[i].steps;

                for (elementId in animationSteps) {
                    initialAnimationStepValues[elementId] = initialAnimationStepValues[elementId] || {};
                    for (property in animationSteps[elementId]) {
                        initialAnimationStepValues[elementId][property] = getCurrentAnimationProvider().getValue(animationElement, elementId, property);
                    }
                }
            }

            return {
                duration: 0,
                steps: initialAnimationStepValues
            };
        }

        function determineAnimation(animationElement) {
            var animationSteps = {}, animateStep, id, property, value, duration;

            duration = parseInt(animationElement.attr('data-duration')) || DEFAULT_DURATION;

            $(ANIMATE_ELEMENT_NAME, animationElement).each(function() {
                animateStep = $(this);
                id = animateStep.attr('data-id');
                property = animateStep.attr('data-property');
                value = animateStep.attr('data-value');

                animationSteps[id] = animationSteps[id] || {};
                animationSteps[id][property] = value;
            });

            return {
                duration: duration,
                steps: animationSteps
            };
        }

        function determineForwardAnimations(currentAnimationElement) {
            var animations = [], animationElement;

            $(ANIMATION_ELEMENT_NAME, currentAnimationElement).each(function() {
                animationElement = $(this);
                animations.push(determineAnimation(animationElement));
            });
            animations.unshift(getInitialValues(currentAnimationElement, animations));

            return animations;
        }

        function getPropertyInForwardAnimations(elementId, property, forwardAnimations) {
            var i, forwardAnimation;

            for (i = 0; i < forwardAnimations.length; i++) {
                forwardAnimation = forwardAnimations[i];
                if (forwardAnimation.steps[elementId] && forwardAnimation.steps[elementId][property]) {
                    return forwardAnimation.steps[elementId][property];
                }
            }

            return null;
        }

        function determineBackwardAnimation(forwardAnimation, forwardAnimations) {
            var elementId, property, animation;

            animation = {
                steps: {},
                duration: forwardAnimation.duration
            };

            for (elementId in forwardAnimation.steps) {
                animation.steps[elementId] = animation.steps[elementId] || {};
                for (property in forwardAnimation.steps[elementId]) {
                    animation.steps[elementId][property] = getPropertyInForwardAnimations(elementId, property, forwardAnimations);
                }
            }

            return animation;
        }

        function determineBackwardAnimations(forwardAnimations) {
            var animations = [], i;

            for (i = 1; i < forwardAnimations.length; i++) {
                animations.push(determineBackwardAnimation(forwardAnimations[i], forwardAnimations.slice(0, i).reverse()));
            }

            return animations;
        }

        function getAnimations() {
            var animationElement = getCurrentAnimationElement();
            var animationElementAnimationId = animationElement.attr(ANIMATION_ID_ATTRIBUTE);

            if (!forwardAnimationsPerElement[animationElementAnimationId]) {
                forwardAnimationsPerElement[animationElementAnimationId] = determineForwardAnimations(animationElement);
                backwardAnimationsPerElement[animationElementAnimationId] = determineBackwardAnimations(forwardAnimationsPerElement[animationElementAnimationId]);
            }

            return {
                'forward': forwardAnimationsPerElement[animationElementAnimationId],
                'backward': backwardAnimationsPerElement[animationElementAnimationId]
            };
        }

        function tryAnimate(previousAnimationNumber, moveDirection) {
            var element = getCurrentAnimationElement();

            var animations = getAnimations();
            var animationNumber = previousAnimationNumber + moveDirection;

            if (animationNumber < 0 || animationNumber >= animations.forward.length) {
                return false;
            }

            var animation = moveDirection == 1 ? animations.forward[animationNumber] : animations.backward[animationNumber];

            if (!animation.steps) {
                return false;
            }

            getCurrentAnimationProvider().animate(element, animation);
            return true;
        }

        function isPrintMediaType() {
            // TODO find a better way to do this
            return (/print-pdf/gi).test(window.location.search);
        }

        function setPrintValuesForElement(element) {
            var animation, immediateAnimation;
            var animations = getAnimations();

            for (var i = 0; i < animations.forward.length; i++) {
                animation = animations.forward[i];
                immediateAnimation = {
                    steps: animation.steps,
                    duration: 0
                };

                getCurrentAnimationProvider().animate(element, immediateAnimation);
            }
        }

        function setPrintValues() {
            if (!isPrintMediaType()) {
                return;
            }

            var selector, elements;
            for (selector in animationProviders) {
                elements = $(selector);

                elements.each(function() {
                    var element = $(this);
                    setPrintValuesForElement(element);
                });
            }
        }


        return {
            initialize: initialize,
            addAnimationProvider: addAnimationProvider,
            setPrintValues: setPrintValues
        };
    };

    Reveal.Animate.Svg = function() {
        var ID_SUFFIX_ATTRIBUTE = 'data-id-suffix';

        var elementsToLoad = -1, elements, element;


        function getIdSuffix(element) {
            return element.attr(ID_SUFFIX_ATTRIBUTE);
        }

        function setIdSuffix(element, suffix) {
            return element.attr(ID_SUFFIX_ATTRIBUTE, suffix);
        }

        function initialize() {
            elements = $('div.svg');
            elementsToLoad = elements.length;

            elements.each(function(number) {
                element = $(this);
                setIdSuffix(element, "-svg-" + number);
                element.svg({ onLoad: function(svg) {
                    svgCanvasCreatedEventHandler(element, svg);
                }});
            });
        }

        function svgCanvasCreatedEventHandler(element, svg) {
            var imgSrc = element.attr('src');
            svg.load(imgSrc, {addTo: true, changeSize: false, onLoad: function() {
                svgImageLoadedEventHandler(element);
            }});
        }

        function svgImageLoadedEventHandler(element) {
            var idSuffix = getIdSuffix(element);

            $("*", element).not('defs').not('defs *').each(function() {
                var element = $(this);
                var id = element.attr('id');

                if (id) {
                    element.attr('id', id + idSuffix);
                }
            });

            elementsToLoad--;
        }

        function checkIfLoaded() {
            if (elementsToLoad != 0) {
                throw new Error("Loading is not fully done yet!");
            }
        }

        function getDefaultValue(property) {
            switch (property) {
                case 'fill':
                    return '#FFFFFF';
                case 'stroke':
                    return '#000000';
                case 'opacity':
                    return 1;
                default:
                    return 0;
            }
        }

        function getValue(animationElement, elementId, property) {
            checkIfLoaded();

            var value;
            var svgCanvas = animationElement.svg('get');
            var idSuffix = getIdSuffix(animationElement);
            var realId = elementId + idSuffix;

            var element = svgCanvas.getElementById(realId);

            if (!element) {
                throw new Error("Element with id '" + elementId + "' does not exist");
            }

            if (['x', 'y', 'width', 'height'].indexOf(property) > -1) {
                value = element[property].baseVal.value;
            } else if (property === 'transform') {
                // TODO return real value
                return "translate(0, 0) rotate(0, 0, 0)";
            } else {
                value = element.style[property];
            }

            if (!value) {
                // TODO get computed value instead
                value = getDefaultValue(property);
            }

            return value;
        }

        function transformValues(values) {
            var transformedValues = {}, key, transformedKey, value;

            for (key in values) {
                if (!values.hasOwnProperty(key)) {
                    continue;
                }

                value = values[key];
                transformedKey = 'svg-' + key;
                transformedValues[transformedKey] = value;
            }

            return transformedValues;
        }

        function animate(animationElement, animation) {
            var elementId, svgCanvas, values;

            checkIfLoaded();

            svgCanvas = animationElement.svg('get');
            var idSuffix = getIdSuffix(animationElement);

            for (elementId in animation.steps) {
                if (!animation.steps.hasOwnProperty(elementId)) {
                    continue;
                }

                var realId = elementId + idSuffix;
                values = transformValues(animation.steps[elementId]);
                $(svgCanvas.getElementById(realId)).animate(values, animation.duration);
            }
        }

        return {
            initialize: initialize,
            getValue: getValue,
            animate: animate
        };
    };

    Reveal.Animate.Html = function() {
        function initialize() {

        }

        function getValue(animationElement, elementId, property) {
            var element = $('#' + elementId, animationElement);

            return element.css(property);
        }

        function animate(animationElement, animation) {
            var elementId, element, values;

            for (elementId in animation.steps) {
                if (!animation.steps.hasOwnProperty(elementId)) {
                    continue;
                }

                values = animation.steps[elementId];
                element = $('#' + elementId, animationElement).animate(values, { duration: animation.duration, easing: 'linear' });
            }
        }

        return {
            initialize: initialize,
            getValue: getValue,
            animate: animate
        };
    };

})(jQuery);
