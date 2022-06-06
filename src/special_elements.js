import React from "react";
import {Tooltip} from "./generic_elements";
import {translateIEItem, upperCaseName} from "./localization";
import {getAssetPath, getIconPath, getRecipePath, getTagPath, MOD_ID} from "./resources";

const SPECIAL_ELEMENT_HEIGHTS = {
    crafting: (e) => 'recipe' in e ? 7 : 'recipes' in e ? 7 * e['recipes'].length : 1,
    item_display: () => 4,
    image: (e) => 'images' in e ? e['images'].reduce((acc, image) => {
        let scale = 55 / image['uSize'];
        return acc + image['vSize'] * scale * 0.25;
    }, 0) : 1,
    blueprint: () => 7,
    multiblock: () => 5,
};

function makeCache(responseProcessor) {
    const cache = {};
    return (url) => {
        if (!(url in cache)) {
            cache[url] = fetch(url)
                .then(response => response.ok ? responseProcessor(response) : undefined)
                .catch(() => undefined);
        }
        return cache[url];
    };
}

const fetchJSON = makeCache(r => r.json());
const fetchBlob = makeCache(r => r.blob());

export function loadSpecialElement(branch, element) {
    // normal recipes
    if (element['type'] === 'crafting') {
        //single recipe
        if (element['recipe'])
            return Recipe.loadRecipe(branch, element['recipe']);
        //multiple recipes
        else if (element['recipes']) {
            let recipes = element['recipes'];
            return Promise.all(recipes.map(recipe => {
                if (Array.isArray(recipe))
                    return MultiRecipe.parseMultiRecipe(branch, recipe);
                else
                    return Recipe.loadRecipe(branch, recipe);
            }));
        }
    }
    // item displays look very silly without textures
    if (element['type'] === 'item_display') {
        return Promise.resolve(element['item'] ? [element['item']] : element['items'])
            .then(res => Promise.all(res.map(item => PreparedIngredient.of(item, branch))))
            .then(res => res.map(item => <Ingredient symbol={'Item'} value={item}/>))
            .then(res => <div className="item_display">{res}</div>);
    }
    // images
    if (element['type'] === 'image') {
        return Promise.resolve(
            <div className="images">
                {element['images'].map((image, idx) => {
                        let scale = 55 / image['uSize'];
                        let offset = [-scale * image['uMin'], -scale * image['vMin']];
                        let style = {
                            'backgroundImage': `url(${getAssetPath(branch)}${image['location']})`,
                            'height': `${scale * image['vSize']}vmin`,
                            'backgroundSize': `${Math.round(256 / image['uSize'] * 100)}%`,
                            'backgroundPosition': `${offset[0]}vmin ${offset[1]}vmin`
                        }
                        return <div className="embedded_image" key={idx} style={style}/>
                    }
                )}
            </div>);
    }
    // blueprints are just shapeless recipes but easier
    if (element['type'] === 'blueprint') {
        //single recipe
        if (element['recipe'])
            return Blueprint.loadRecipes(branch, [element['recipe']]);
        //multiple recipes
        else if (element['recipes'])
            return Blueprint.loadRecipes(branch, element['recipes']);
    }
    // multiblocks are not rendered
    if (element['type'] === 'multiblock') {
        return Promise.resolve(<div className="multiblock">
            In the ingame manual, you would see a cool looking multiblock here.<br/>
            {element['name']}
        </div>)
    }
    return new Promise((resolve, reject) => resolve(null));
}

export function getSpecialHeight(element) {
    if (!element)
        return 0;
    let type = element['type'] || '';
    if (!(type in SPECIAL_ELEMENT_HEIGHTS))
        return 0;
    return SPECIAL_ELEMENT_HEIGHTS[type](element) || 0;
}

function decomposeResourceLocation(fullName) {
    let split = fullName.split(':');
    let domain = split.length > 1 ? split[0] : MOD_ID;
    let name = split[split.length - 1];
    return {domain: domain, name: name};
}

function ingredientTooltip(currentItemParts, ingredient) {
    let tagInfo;
    if (ingredient['tag']) {
        tagInfo = <span>Tag: {ingredient['tag']}</span>;
        if (!currentItemParts) {
            return tagInfo;
        }
    }
    let domain;
    let name;
    if (currentItemParts.domain === MOD_ID) {
        name = translateIEItem(currentItemParts.name);
        domain = 'Immersive Engineering';
    } else {
        domain = upperCaseName(currentItemParts.domain);
        name = upperCaseName(currentItemParts.name);
    }
    return (<>
        <span>{name}</span><br/>
        <span className="domain formatting_o">{domain}</span>
        {tagInfo && <br/>} {tagInfo}
    </>);
}

function getItemsToShow(ingredient, branch) {
    if (ingredient['item']) {
        return [decomposeResourceLocation(ingredient['item'])];
    } else if (ingredient['tag']) {
        const basePath = getTagPath(branch);
        const tagParts = decomposeResourceLocation(ingredient['tag']);
        return fetchJSON(`${basePath}/${tagParts.domain}/${tagParts.name}.json`)
            .then(res => res.map(decomposeResourceLocation))
            .catch(err => undefined);
    }
    return undefined;
}

function unwrapIngredient(ingredient) {
    while (ingredient && ingredient['base_ingredient']) {
        ingredient = ingredient['base_ingredient'];
    }
    return ingredient;
}

class IngredientOption {
    itemImage;
    tooltip;

    constructor(itemImage, tooltip) {
        this.itemImage = itemImage;
        this.tooltip = tooltip;
    }
}

class PreparedIngredient {
    count;
    options;

    constructor(count, options) {
        this.count = count;
        this.options = options;
    }

    static async of(ingredientJson, branch) {
        ingredientJson = unwrapIngredient(ingredientJson);
        if (ingredientJson) {
            const items = await getItemsToShow(ingredientJson, branch);
            let optionPromises;
            if (items) {
                optionPromises = items.map(async item => {
                    const itemImage = await imageForItem(item, branch);
                    return new IngredientOption(itemImage, ingredientTooltip(item, ingredientJson));
                });
            } else {
                // Support for old branches without tag data
                optionPromises = [new IngredientOption(undefined, ingredientTooltip(undefined, ingredientJson))];
            }
            return new PreparedIngredient(ingredientJson['count'] || 1, await Promise.all(optionPromises));
        }
        return undefined;
    }
}

class Recipe extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.data['pattern'])
            return Recipe.buildShapedRecipe(this.props.name, this.props.data);
        else if (this.props.data['ingredients'])
            return Recipe.buildShapelessRecipe(this.props.name, this.props.data);
    }

    static loadRecipeFromElement(branch, element) {
        if (typeof element === 'string')
            return Recipe.loadRecipe(branch, element);
        else if (typeof element === 'object' && 'recipe' in element)
            return Recipe.loadRecipe(branch, element['recipe']);
        return null;
    }

    static async loadRecipe(branch, key) {
        let json = await fetchJSON(`${getRecipePath(branch)}${key}.json`);
        if ('baseRecipe' in json) {
            json = json['baseRecipe'];
        }
        const recipeData = {};
        if ('pattern' in json) {
            let newKeys = {};
            for (const key in json.key) {
                newKeys[key] = await PreparedIngredient.of(json.key[key], branch);
            }
            recipeData['key'] = newKeys;
            recipeData['pattern'] = json['pattern'];
        } else if ('ingredients' in json) {
            let newIngredients = [];
            for (const ingredient of json.ingredients) {
                newIngredients.push(await PreparedIngredient.of(ingredient, branch));
            }
            recipeData['ingredients'] = newIngredients;
        }
        recipeData['result'] = await PreparedIngredient.of(json.result, branch);
        return <Recipe name={key} key={key} data={recipeData}/>;
    }

    static buildShapedRecipe(name, data) {
        let patternFlat = data.pattern.join('').split('');
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + data.pattern[0].length}>
                    {patternFlat.map((c, i) => <Ingredient key={i} symbol={c} value={data.key[c]}/>)}
                </div>
                <div className="crafting-arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }

    static buildShapelessRecipe(name, data) {
        let cols = data.ingredients.length === 1 ? 1 : data.ingredients.length < 5 ? 2 : 3;
        return (
            <div className="recipe" name={name}>
                <div className={'grid col' + cols}>
                    {data.ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="crafting-arrow"/>
                <div className="output">
                    <Ingredient symbol={'?'} value={data.result}/>
                </div>
            </div>
        );
    }
}

class MultiRecipe extends React.Component {
    constructor(props) {
        super(props);
        this.state = {recipeIdx: 0};
    }

    static parseMultiRecipe(branch, array) {
        return Promise.all(array.map(o => Recipe.loadRecipeFromElement(branch, o)).filter(r => r != null))
            .then(recipes => <MultiRecipe recipes={recipes}/>);
    }

    render() {
        return <div className="multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }
}

async function imageForItem(item, branch) {
    const basePath = getIconPath(branch);
    const iconPath = basePath + item.domain + '/' + item.name + '.png';
    const blob = await fetchBlob(iconPath);
    if (blob) {
        return <img className="item" alt={item.domain + ':' + item.name} src={URL.createObjectURL(blob)}/>;
    } else {
        return undefined;
    }
}

function Ingredient(props) {
    const [optionId, setOptionId] = React.useState(0);
    let ingredient = props['value'];
    React.useEffect(() => {
        if (!ingredient || ingredient.options.length < 2) {
            return;
        }
        const timerId = setInterval(() => setOptionId((optionId + 1) % ingredient.options.length), 1000);
        return () => clearInterval(timerId);
    }, [props.value, ingredient, optionId]);
    if (!ingredient)
        return <div className="item empty"/>;
    else {
        const currentOption = ingredient.options[optionId];
        return <div className="item" onMouseMove={
            event => {
                let tooltip = event.currentTarget.querySelector('.tooltip');
                if (tooltip) {
                    tooltip.style.position = 'fixed';
                    tooltip.style.top = `calc(${event.clientY}px + 2vmin)`;
                    tooltip.style.left = event.clientX + 'px';
                }
            }
        }>
            {currentOption.itemImage ? currentOption.itemImage : <span className="symbol">{props.symbol}</span>}
            {ingredient.count > 1 && <span className="count">{ingredient.count}</span>}
            <Tooltip text={currentOption.tooltip}/>
        </div>;
    }
}

class Blueprint extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            recipeIdx: 0
        };
    }

    render() {
        return <div className="blueprint multi_recipe">
            <button
                className={"recipe_prev" + (this.state.recipeIdx > 0 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx - 1})}/>
            {this.props.recipes[this.state.recipeIdx]}
            <button
                className={"recipe_next" + (this.state.recipeIdx < this.props.recipes.length - 1 ? '' : ' off')}
                onClick={() => this.setState({recipeIdx: this.state.recipeIdx + 1})}/>
        </div>;
    }

    static loadRecipes(branch, recipes) {
        return Promise.all(recipes.map(
            obj => obj['item'].split(':').pop()
        ).map(
            key => fetchJSON(`${getRecipePath(branch)}blueprint/${key}.json`)
                .then(out => Blueprint.buildRecipe(key, out, branch))
        )).then(values => <Blueprint recipes={values}/>);
    }

    static async buildRecipe(name, data, branch) {
        let cols = data.inputs.length === 1 ? 1 : data.inputs.length < 5 ? 2 : 3;
        let ingredients = [];
        for (const e of data.inputs) {
            ingredients.push(await PreparedIngredient.of(e, branch));
        }
        return (
            <div className="recipe" name={name}>
                <div className="blueprint-ingredient">
                    <Ingredient symbol={'B'} value={await PreparedIngredient.of({item: "immersiveengineering:blueprint"}, branch)}/>
                </div>
                <div className={'grid col' + cols}>
                    {ingredients.map((e, i) => <Ingredient key={i} symbol={i} value={e}/>)}
                </div>
                <div className="output">
                    <Ingredient symbol={'?'} value={await PreparedIngredient.of(data.result, branch)}/>
                </div>
            </div>
        );
    }
}
